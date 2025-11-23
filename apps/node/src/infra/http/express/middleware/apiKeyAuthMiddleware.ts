import type { Request, Response, NextFunction } from 'express';
import { LoggerPort } from '@core-application';

const norm = (s: string | undefined) => (s ?? '').replace(/^\uFEFF/, '').trim();
const mask = (s: string) => (!s ? '∅' : s.length <= 6 ? '***' : `${s.slice(0, 3)}…${s.slice(-2)}`);

export function createApiKeyAuthMiddleware(expectedRaw: string, logger?: LoggerPort) {
  const expected = norm(expectedRaw);

  return (req: Request, res: Response, next: NextFunction) => {
    const got = norm(req.get('x-api-key') ?? '');

    const logMeta = {
      method: req.method,
      path: req.path,
      gotMasked: mask(got),
      gotLen: got.length,
      gotHex: Buffer.from(got).toString('hex'),
      expectedMasked: mask(expected),
      expectedLen: expected.length,
      expectedHex: Buffer.from(expected).toString('hex'),
      requestId: req.headers['x-request-id'],
    };

    logger?.debug('[auth] API key check', logMeta);

    if (!expected) {
      logger?.error('[auth] API key missing in server config', logMeta);
      return res.status(500).json({ ok: false, error: 'server misconfigured (API_KEY)' });
    }
    if (!got) {
      logger?.warn('[auth] Missing API key in request', logMeta);
      return res.status(401).json({ ok: false, error: 'missing api key' });
    }
    if (got !== expected) {
      logger?.warn('[auth] Invalid API key provided', logMeta);
      return res.status(403).json({ ok: false, error: 'Invalid API key' });
    }

    logger?.info('[auth] API key validated', logMeta);
    next();
  };
}
