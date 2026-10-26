import { hkdfSync, randomBytes } from 'node:crypto';

import type { LoggerPort } from '@core-domain';

const KEY_LENGTH_BYTES = 32;
const MIN_SECRET_LENGTH = 32;
const MIN_DISTINCT_CHARACTERS = 8;
const PLACEHOLDER_SECRET = /^CHANGE_ME/i;
const HKDF_SALT = 'obsidian-vps-publish/admin-session/v1';

export interface AdminSessionKeyInput {
  /** Value of ADMIN_SESSION_SECRET, when configured. */
  configuredSecret: string | undefined;
  usernameHash: string;
  passwordHash: string;
}

/**
 * Derives the HMAC key that signs admin session tokens.
 *
 * The credential hashes are only the HKDF context (`info`), never the key
 * material: a leaked hash alone cannot forge a token, while rotating the
 * password still invalidates every token issued before.
 *
 * Without a usable secret (unset, shorter than 32 characters or a CHANGE_ME
 * placeholder) a random one is generated at startup, so tokens do not survive a restart. That matches the in-memory revocation list, which
 * does not either.
 */
export function deriveAdminSessionKey(input: AdminSessionKeyInput, logger?: LoggerPort): Buffer {
  const { usernameHash, passwordHash } = input;
  const configuredSecret = usableSecret(input.configuredSecret, logger);

  const secret: string | Buffer = configuredSecret ?? randomBytes(KEY_LENGTH_BYTES);
  // JSON keeps the pair unambiguous, whatever characters the hashes contain.
  const info = JSON.stringify([usernameHash, passwordHash]);

  return Buffer.from(hkdfSync('sha256', secret, HKDF_SALT, info, KEY_LENGTH_BYTES));
}

/**
 * The configured secret when it can be trusted, otherwise undefined (the caller then falls
 * back to a random key). A short value or an example placeholder copied from the deployment
 * template is as good as no secret. The value itself is never logged.
 */
function usableSecret(secret: string | undefined, logger?: LoggerPort): string | undefined {
  if (!secret) {
    logger?.warn(
      'ADMIN_SESSION_SECRET is not set: a random signing key was generated, admin sessions will not survive a restart'
    );
    return undefined;
  }
  if (secret.length < MIN_SECRET_LENGTH || PLACEHOLDER_SECRET.test(secret)) {
    logger?.warn(
      `ADMIN_SESSION_SECRET is ignored because it is shorter than ${MIN_SECRET_LENGTH} characters or still a CHANGE_ME placeholder: a random signing key was generated, admin sessions will not survive a restart`
    );
    return undefined;
  }
  if (new Set(secret).size < MIN_DISTINCT_CHARACTERS) {
    // Accepted on purpose: the length is the rejection criterion, this is only a hint.
    logger?.warn(
      `ADMIN_SESSION_SECRET has fewer than ${MIN_DISTINCT_CHARACTERS} distinct characters: it is used, but it looks guessable, prefer a long random value`
    );
  }
  return secret;
}
