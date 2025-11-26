import { Router, Request, Response } from 'express';

import { LoggerPort } from '@core-application';

export function createPingController(logger?: LoggerPort): Router {
  const router = Router();

  router.get('/ping', (req: Request, res: Response) => {
    logger?.info('Received ping request', { path: req.path, method: req.method });
    return res.status(200).json({ api: 'ok' });
  });

  return router;
}
