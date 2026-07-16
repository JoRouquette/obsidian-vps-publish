import type { LoggerPort } from '@core-domain';
import { type Request, type Response, Router } from 'express';

import { verifyAdminSecret } from '../../../admin/admin-credential.util';
import type { AdminSessionTokenService } from '../../../admin/admin-session-token.service';

interface AdminAuthConfig {
  usernameHash: string;
  passwordHash: string;
}

function readBodyString(body: unknown, keys: string[]): string | undefined {
  if (typeof body !== 'object' || body === null) {
    return undefined;
  }
  const record = body as Record<string, unknown>;
  return keys
    .map((key) => record[key])
    .find((value): value is string => typeof value === 'string' && value.length > 0);
}

/**
 * Exposes `POST /login`, which exchanges admin credentials (read from the
 * request body only, never the query string) for a short-lived session token.
 * Credentials are verified once here; every subsequent admin request is
 * authenticated with the returned token, so the password is never persisted or
 * re-sent by the client.
 */
export function createAdminAuthController(
  config: AdminAuthConfig,
  tokenService: AdminSessionTokenService,
  logger?: LoggerPort
): Router {
  const router = Router();
  const log = logger?.child({ module: 'adminAuthController' });

  router.post('/login', (req: Request, res: Response) => {
    const user = readBodyString(req.body, ['user', 'username']);
    const password = readBodyString(req.body, ['mdp', 'password']);

    if (!user || !password) {
      return res.status(401).json({ ok: false, error: 'missing admin credentials' });
    }

    const isValidUser = verifyAdminSecret(user, config.usernameHash);
    const isValidPassword = verifyAdminSecret(password, config.passwordHash);

    if (!isValidUser || !isValidPassword) {
      log?.warn('Invalid admin credentials');
      return res.status(403).json({ ok: false, error: 'invalid admin credentials' });
    }

    const { token, expiresAt } = tokenService.createToken();
    return res.status(200).json({ token, expiresAt });
  });

  return router;
}
