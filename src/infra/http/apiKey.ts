import type { Request, Response, NextFunction } from 'express';

const mask = (s: string) => (s.length <= 6 ? '***' : `${s.slice(0, 3)}…${s.slice(-2)}`);

export function createApiKeyMiddleware(expectedKey: string) {
  if (!expectedKey) {
    console.warn('[auth] API key is empty at startup — server misconfigured');
  }

  return function apiKey(req: Request, res: Response, next: NextFunction) {
    const got = req.get('x-api-key') ?? '';

    if (!expectedKey) {
      return res.status(500).json({ ok: false, error: 'server misconfigured (missing API_KEY)' });
    }
    if (!got) {
      return res.status(401).json({ ok: false, error: 'missing api key' });
    }
    if (got !== expectedKey) {
      return res.status(403).json({ ok: false, error: 'invalid api key' });
    }
    return next();
  };
}
