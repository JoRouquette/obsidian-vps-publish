import { Request, Response, NextFunction } from 'express';

export function createCorsMiddleware(allowedOrigins: string[]) {
  const allowAll = allowedOrigins.includes('*');

  return function corsMiddleware(req: Request, res: Response, next: NextFunction) {
    const origin = req.header('origin');

    if (origin && (allowAll || allowedOrigins.includes(origin))) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
    }

    res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    return next();
  };
}
