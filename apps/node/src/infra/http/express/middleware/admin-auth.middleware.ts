import type { LoggerPort } from '@core-domain';
import type { NextFunction, Request, Response } from 'express';

import { verifyAdminSecret } from '../../../admin/admin-credential.util';

interface AdminAuthConfig {
  usernameHash: string;
  passwordHash: string;
}

function extractCredential(req: Request, keys: string[]): string | undefined {
  const fromQuery = keys
    .map((key) => req.query[key])
    .find((value): value is string => typeof value === 'string' && value.length > 0);
  if (fromQuery) return fromQuery;

  const body = req.body as Record<string, unknown> | undefined;
  if (body) {
    const fromBody = keys
      .map((key) => body[key])
      .find((value): value is string => typeof value === 'string' && value.length > 0);
    if (fromBody) return fromBody;
  }

  return keys
    .map((key) => req.header(`x-admin-${key}`))
    .find((value): value is string => typeof value === 'string' && value.length > 0);
}

export function createAdminAuthMiddleware(config: AdminAuthConfig, logger?: LoggerPort) {
  const log = logger?.child({ module: 'adminAuthMiddleware' });

  return (req: Request, res: Response, next: NextFunction) => {
    const user = extractCredential(req, ['user', 'username']);
    const password = extractCredential(req, ['mdp', 'password']);

    if (!user || !password) {
      return res.status(401).json({
        ok: false,
        error: 'missing admin credentials',
      });
    }

    const isValidUser = verifyAdminSecret(user, config.usernameHash);
    const isValidPassword = verifyAdminSecret(password, config.passwordHash);

    if (!isValidUser || !isValidPassword) {
      log?.warn('Invalid admin credentials');
      return res.status(403).json({
        ok: false,
        error: 'invalid admin credentials',
      });
    }

    next();
  };
}
