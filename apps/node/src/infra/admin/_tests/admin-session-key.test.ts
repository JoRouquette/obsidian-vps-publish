import type { LoggerPort } from '@core-domain';

import { deriveAdminSessionKey } from '../admin-session-key';
import { AdminSessionTokenService } from '../admin-session-token.service';

const HASHES = { usernameHash: 'scrypt$u$hash', passwordHash: 'scrypt$p$hash' };
const SECRET_A = 'server-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SECRET_B = 'server-secret-bbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function buildLogger() {
  const warn = jest.fn();
  return { logger: { warn } as unknown as LoggerPort, warn };
}

function serviceFor(configuredSecret: string | undefined, passwordHash = HASHES.passwordHash) {
  return new AdminSessionTokenService(
    deriveAdminSessionKey({ configuredSecret, ...HASHES, passwordHash })
  );
}

describe('deriveAdminSessionKey', () => {
  it('derives the same key from the same secret and hashes', () => {
    const first = deriveAdminSessionKey({ configuredSecret: SECRET_A, ...HASHES });
    const second = deriveAdminSessionKey({ configuredSecret: SECRET_A, ...HASHES });

    expect(first.equals(second)).toBe(true);
    expect(first).toHaveLength(32);
  });

  it('does not let services with different secrets validate each other tokens', () => {
    const issuer = serviceFor(SECRET_A);
    const verifier = serviceFor(SECRET_B);

    expect(verifier.validateToken(issuer.createToken().token)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('invalidates tokens when the credential hashes change under the same secret', () => {
    const before = serviceFor(SECRET_A);
    const afterPasswordChange = serviceFor(SECRET_A, 'scrypt$p$other-hash');

    expect(afterPasswordChange.validateToken(before.createToken().token)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('validates tokens across instances sharing secret and hashes', () => {
    const issuer = serviceFor(SECRET_A);
    const verifier = serviceFor(SECRET_A);

    expect(verifier.validateToken(issuer.createToken().token).ok).toBe(true);
  });

  it('does not accept a token signed with a key derived from the hashes alone', () => {
    const forger = new AdminSessionTokenService(`${HASHES.usernameHash}:${HASHES.passwordHash}`);
    const service = serviceFor(SECRET_A);

    expect(service.validateToken(forger.createToken().token).ok).toBe(false);
  });

  describe('without a configured secret', () => {
    it('generates a different key on each call', () => {
      const first = deriveAdminSessionKey({ configuredSecret: undefined, ...HASHES });
      const second = deriveAdminSessionKey({ configuredSecret: undefined, ...HASHES });

      expect(first.equals(second)).toBe(false);
    });

    it('warns once that sessions will not survive a restart', () => {
      const { logger, warn } = buildLogger();

      deriveAdminSessionKey({ configuredSecret: undefined, ...HASHES }, logger);

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('ADMIN_SESSION_SECRET');
    });

    it('treats an empty secret as not configured', () => {
      const { logger, warn } = buildLogger();

      deriveAdminSessionKey({ configuredSecret: '', ...HASHES }, logger);

      expect(warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('with a secret that cannot be trusted', () => {
    const shortSecret = 'x'.repeat(31);
    const placeholders = [
      'CHANGE_ME_RANDOM_SECRET_PLACEHOLDER_VALUE',
      'change_me_random_secret_placeholder_value',
    ];

    it.each([[shortSecret], ['tiny-key'], ...placeholders.map((value) => [value])])(
      'ignores %j, warns without printing it and falls back to a random key',
      (secret) => {
        const { logger, warn } = buildLogger();

        const first = deriveAdminSessionKey({ configuredSecret: secret, ...HASHES }, logger);
        const second = deriveAdminSessionKey({ configuredSecret: secret, ...HASHES });

        expect(first.equals(second)).toBe(false);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('ADMIN_SESSION_SECRET');
        expect(JSON.stringify(warn.mock.calls)).not.toContain(secret);
      }
    );

    it('does not let a short secret sign tokens another instance can verify', () => {
      expect(
        serviceFor(shortSecret).validateToken(serviceFor(shortSecret).createToken().token).ok
      ).toBe(false);
    });
  });

  describe('with a valid secret', () => {
    it('accepts a secret of exactly 32 characters without warning', () => {
      const { logger, warn } = buildLogger();
      const secret = 'abcdefghijklmnopqrstuvwxyz012345';

      const first = deriveAdminSessionKey({ configuredSecret: secret, ...HASHES }, logger);
      const second = deriveAdminSessionKey({ configuredSecret: secret, ...HASHES });

      expect(first.equals(second)).toBe(true);
      expect(warn).not.toHaveBeenCalled();
    });

    it('uses a 32-character secret with few distinct characters but warns without printing it', () => {
      const { logger, warn } = buildLogger();
      const secret = 'ab'.repeat(16);

      const first = deriveAdminSessionKey({ configuredSecret: secret, ...HASHES }, logger);
      const second = deriveAdminSessionKey({ configuredSecret: secret, ...HASHES });

      expect(first.equals(second)).toBe(true);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('distinct characters');
      expect(JSON.stringify(warn.mock.calls)).not.toContain(secret);
    });

    it('does not warn at exactly 8 distinct characters', () => {
      const { logger, warn } = buildLogger();

      deriveAdminSessionKey({ configuredSecret: 'abcdefgh'.repeat(4), ...HASHES }, logger);

      expect(warn).not.toHaveBeenCalled();
    });

    it('does not warn when a longer secret is configured', () => {
      const { logger, warn } = buildLogger();

      deriveAdminSessionKey({ configuredSecret: SECRET_A, ...HASHES }, logger);

      expect(warn).not.toHaveBeenCalled();
    });
  });
});
