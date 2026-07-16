import type { LoggerPort } from '@core-domain';
import type { NextFunction, Request, Response } from 'express';

import type { AdminSessionTokenService } from '../../../admin/admin-session-token.service';

const BEARER_PREFIX = 'Bearer ';

function extractBearerToken(req: Request): string | undefined {
  const header = req.header('authorization') ?? '';
  if (!header.startsWith(BEARER_PREFIX)) {
    return undefined;
  }
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : undefined;
}

/**
 * Protects admin dashboard routes by requiring a valid session token issued by
 * the login controller, supplied as `Authorization: Bearer <token>`.
 */
export function createAdminTokenAuthMiddleware(
  tokenService: AdminSessionTokenService,
  logger?: LoggerPort
) {
  const log = logger?.child({ module: 'adminTokenAuthMiddleware' });

  return (req: Request, res: Response, next: NextFunction) => {
    const result = tokenService.validateToken(extractBearerToken(req));

    if (!result.ok) {
      log?.warn('Admin session token rejected', { reason: result.reason });
      return res.status(401).json({ ok: false, error: 'invalid admin session' });
    }

    next();
  };
}
