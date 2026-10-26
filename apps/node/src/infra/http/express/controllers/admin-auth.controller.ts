import type { LoggerPort } from '@core-domain';
import { type Request, type Response, Router } from 'express';

import { verifyAdminSecret } from '../../../admin/admin-credential.util';
import type { AdminSessionTokenService } from '../../../admin/admin-session-token.service';
import { createLoginThrottle } from '../../../admin/login-throttle';
import { extractBearerToken } from '../utils/bearer-token.util';
import { asyncRoute } from './async-route.util';

const MAX_LOGIN_FAILURES = 5;
const LOGIN_FAILURE_WINDOW_MS = 60_000;
// Bounds the work scrypt does on attacker-controlled input.
const MAX_CREDENTIAL_LENGTH = 1024;

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
 * re-sent by the client. `POST /logout` revokes the bearer token it receives.
 */
export function createAdminAuthController(
  config: AdminAuthConfig,
  tokenService: AdminSessionTokenService,
  logger?: LoggerPort,
  now: () => number = () => performance.now()
): Router {
  const router = Router();
  const log = logger?.child({ module: 'adminAuthController' });

  // Global limiter, not per client: node runs as a single process and req.ip is always the
  // reverse proxy. As a result, anyone can keep the admin login blocked by failing 5 times a
  // minute. Move to per-IP once `trust proxy` is configured.
  const throttle = createLoginThrottle({
    maxFailures: MAX_LOGIN_FAILURES,
    windowMs: LOGIN_FAILURE_WINDOW_MS,
    now,
  });

  router.post(
    '/login',
    asyncRoute(async (req: Request, res: Response) => {
      const user = readBodyString(req.body, ['user', 'username']);
      const password = readBodyString(req.body, ['mdp', 'password']);

      if (!user || !password) {
        return res.status(401).json({ ok: false, error: 'missing admin credentials' });
      }

      if (user.length > MAX_CREDENTIAL_LENGTH || password.length > MAX_CREDENTIAL_LENGTH) {
        return res.status(400).json({ ok: false, error: 'admin credentials too long' });
      }

      const attempt = throttle.tryAcquire();
      if (!attempt.ok) {
        if (attempt.blockStarted) {
          log?.warn('Admin login rate limited');
        }
        res.setHeader('Retry-After', String(attempt.retryAfterSeconds));
        return res.status(429).json({ ok: false, error: 'too many admin login attempts' });
      }

      let isValid: boolean | undefined;
      try {
        // Both checks always run so the response time does not reveal which one failed.
        const results = await Promise.all([
          verifyAdminSecret(user, config.usernameHash),
          verifyAdminSecret(password, config.passwordHash),
        ]);
        isValid = results.every(Boolean);
      } finally {
        // A thrown verification is a server error, not a wrong guess: it frees the slot uncounted.
        attempt.release(isValid === false);
      }

      if (!isValid) {
        log?.warn('Invalid admin credentials');
        return res.status(403).json({ ok: false, error: 'invalid admin credentials' });
      }

      const { token, expiresAt } = tokenService.createToken();
      return res.status(200).json({ token, expiresAt });
    })
  );

  // Always 204: logout is idempotent and must not reveal whether the token was valid.
  router.post('/logout', (req: Request, res: Response) => {
    tokenService.revokeToken(extractBearerToken(req));
    res.status(204).end();
  });

  return router;
}
