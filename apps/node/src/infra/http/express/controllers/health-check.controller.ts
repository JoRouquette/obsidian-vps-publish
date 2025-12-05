import { type LoggerPort } from '@core-application';
import { type Request, type Response, Router } from 'express';

export function createHealthCheckController(logger?: LoggerPort): Router {
  logger = logger?.child({ module: 'HealthCheckController' });

  const router = Router();

  router.get('/health', (req: Request, res: Response) => {
    logger?.debug('Health check requested');

    const result = res.status(200).json({ status: 'healthy' });
    logger?.debug('response : ', { result: result });

    return result;
  });

  return router;
}
