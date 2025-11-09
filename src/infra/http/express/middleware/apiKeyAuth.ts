import type { Request, Response, NextFunction } from 'express';

const norm = (s: string | undefined) => (s ?? '').replace(/^\uFEFF/, '').trim();
const mask = (s: string) => (!s ? '∅' : s.length <= 6 ? '***' : `${s.slice(0, 3)}…${s.slice(-2)}`);

export function createApiKeyAuthMiddleware(expectedRaw: string) {
  const expected = norm(expectedRaw);

  return (req: Request, res: Response, next: NextFunction) => {
    const got = norm(req.get('x-api-key') ?? '');

    // // Log DIAGNOSTIC : longueurs + hex pour détecter CRLF/BOM/espace
    // console.log(
    //   `[auth] ${req.method} ${req.path} ` +
    //     `got=${mask(got)} len=${got.length} hex=${Buffer.from(got).toString('hex')} ` +
    //     `expected=${mask(expected)} len=${expected.length} hex=${Buffer.from(expected).toString('hex')}`
    // );

    if (!expected)
      return res.status(500).json({ ok: false, error: 'server misconfigured (API_KEY)' });
    if (!got) return res.status(401).json({ ok: false, error: 'missing api key' });
    if (got !== expected) return res.status(403).json({ ok: false, error: 'Invalid API key' });

    next();
  };
}
