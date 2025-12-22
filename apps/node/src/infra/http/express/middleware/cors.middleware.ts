import { type LoggerPort } from '@core-domain';
import { type NextFunction, type Request, type Response } from 'express';

export function createCorsMiddleware(allowedOrigins: string[], logger?: LoggerPort) {
  const allowAll = allowedOrigins.includes('*');

  return function corsMiddleware(req: Request, res: Response, next: NextFunction) {
    const origin = req.header('origin');

    if (origin && (allowAll || allowedOrigins.includes(origin))) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
      logger?.debug('CORS allowed for origin', { origin });
    } else if (origin) {
      logger?.warn('CORS denied for origin', { origin });
    }

    res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
      logger?.debug('CORS preflight request handled', { origin, method: req.method });
      return res.sendStatus(200);
    }

    return next();
  };
}
