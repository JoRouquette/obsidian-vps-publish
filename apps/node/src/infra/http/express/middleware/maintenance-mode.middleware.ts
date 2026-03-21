import type { LoggerPort } from '@core-domain';
import type { NextFunction, Request, Response } from 'express';

import { type AdminRuntimeControlService } from '../../../admin/admin-runtime-control.service';

export function createMaintenanceModeMiddleware(
  runtimeControl: AdminRuntimeControlService,
  logger?: LoggerPort
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const maintenance = runtimeControl.getMaintenanceState();
    if (!maintenance.enabled) {
      next();
      return;
    }

    if (req.path === '/ping' && req.method === 'GET') {
      next();
      return;
    }

    logger?.warn('Request blocked by maintenance mode', {
      path: req.path,
      method: req.method,
    });

    res.status(503).json({
      status: 'maintenance_mode',
      message: maintenance.message ?? 'Maintenance mode is enabled',
      enabledAt: maintenance.changedAt,
    });
  };
}
