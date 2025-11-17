import { Router, Request, Response } from 'express';
import { LoggerPort } from '../../../../application/ports/LoggerPort';

export function createHealthCheckController(logger?: LoggerPort): Router {
  const router = Router();

  router.get('/health', (req: Request, res: Response) => {
    logger?.info('Health check requested');
    return res.status(200).json({ status: 'healthy' });
  });

  return router;
}
