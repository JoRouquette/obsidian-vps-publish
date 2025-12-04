import { Request, Response, Router } from 'express';

import { LoggerPort } from '@core-domain';

import { StagingManager } from '../../../filesystem/staging-manager';
import { VpsCleanupBodyDto } from '../dto/vps-cleanup-body.dto';

export function createMaintenanceController(
  stagingManager: StagingManager,
  logger?: LoggerPort
): Router {
  const router = Router();
  const log = logger?.child({ module: 'maintenanceController' });

  router.post('/maintenance/cleanup', async (req: Request, res: Response) => {
    const routeLogger = log?.child({ route: '/maintenance/cleanup', method: 'POST' });

    const parsed = VpsCleanupBodyDto.safeParse(req.body);
    if (!parsed.success) {
      routeLogger?.warn('Invalid cleanup payload', { error: parsed.error });
      return res.status(400).json({ status: 'invalid_payload' });
    }

    try {
      routeLogger?.warn('Executing VPS cleanup', { targetName: parsed.data.targetName });
      await stagingManager.purgeAll();
      return res.status(200).json({ status: 'ok', cleared: ['content', 'assets'] });
    } catch (err) {
      routeLogger?.error('Error while cleaning VPS', { err });
      return res.status(500).json({ status: 'error' });
    }
  });

  return router;
}
