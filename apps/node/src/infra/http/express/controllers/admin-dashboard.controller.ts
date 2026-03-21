import type { LoggerPort } from '@core-domain';
import { type Request, type Response, Router } from 'express';

import type { AdminDashboardService } from '../../../admin/admin-dashboard.service';
import { asyncRoute } from './async-route.util';

export function createAdminDashboardController(
  adminService: AdminDashboardService,
  logger?: LoggerPort
): Router {
  const router = Router();
  const log = logger?.child({ module: 'adminDashboardController' });

  router.get(
    '/summary',
    asyncRoute(async (_req: Request, res: Response) => {
      const snapshot = await adminService.getSnapshot();
      return res.status(200).json(snapshot);
    })
  );

  router.get(
    '/logs',
    asyncRoute(async (req: Request, res: Response) => {
      const requestedLimit = Number(req.query['limit'] ?? '200');
      const level = typeof req.query['level'] === 'string' ? req.query['level'] : undefined;
      const limit = Number.isFinite(requestedLimit)
        ? Math.max(1, Math.min(500, Math.trunc(requestedLimit)))
        : 200;
      const logs = await adminService.getLogTail(limit, normalizeLevel(level));
      return res.status(200).json(logs);
    })
  );

  router.get(
    '/notifications',
    asyncRoute(async (req: Request, res: Response) => {
      const requestedLimit = Number(req.query['limit'] ?? '20');
      const limit = Number.isFinite(requestedLimit)
        ? Math.max(1, Math.min(100, Math.trunc(requestedLimit)))
        : 20;
      const notifications = await adminService.getNotifications(limit);
      return res.status(200).json({ notifications });
    })
  );

  router.get(
    '/history',
    asyncRoute(async (req: Request, res: Response) => {
      const requestedLimit = Number(req.query['limit'] ?? '15');
      const limit = Number.isFinite(requestedLimit)
        ? Math.max(1, Math.min(100, Math.trunc(requestedLimit)))
        : 15;
      const history = await adminService.getHistory(limit);
      return res.status(200).json(history);
    })
  );

  router.post(
    '/logs/rotate',
    asyncRoute(async (_req: Request, res: Response) => {
      const result = await adminService.rotateLogFile();
      return res.status(200).json(result);
    })
  );

  router.post(
    '/controls/maintenance',
    asyncRoute(async (req: Request, res: Response) => {
      const enabled = normalizeBoolean(req.body?.enabled);
      if (enabled === null) {
        return res.status(400).json({ ok: false, error: 'invalid_maintenance_payload' });
      }

      const message = typeof req.body?.message === 'string' ? req.body.message : null;
      const state = adminService.updateMaintenanceMode(enabled, message);
      return res.status(200).json({ maintenance: state });
    })
  );

  router.post(
    '/controls/backpressure',
    asyncRoute(async (req: Request, res: Response) => {
      const maxActiveRequests = normalizePositiveNumber(req.body?.maxActiveRequests);
      const maxEventLoopLagMs = normalizePositiveNumber(req.body?.maxEventLoopLagMs);
      const maxMemoryUsageMB = normalizePositiveNumber(req.body?.maxMemoryUsageMB);

      if (!maxActiveRequests && !maxEventLoopLagMs && !maxMemoryUsageMB) {
        return res.status(400).json({ ok: false, error: 'invalid_backpressure_payload' });
      }

      const config = adminService.updateBackpressure({
        maxActiveRequests,
        maxEventLoopLagMs,
        maxMemoryUsageMB,
      });

      return res.status(200).json({ config });
    })
  );

  router.use((error: unknown, _req: Request, res: Response, _next: () => void) => {
    log?.error('Admin dashboard request failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ ok: false, error: 'admin_dashboard_error' });
  });

  return router;
}

function normalizeLevel(
  level: string | undefined
): 'debug' | 'info' | 'warn' | 'error' | undefined {
  if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') {
    return level;
  }
  return undefined;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  return null;
}

function normalizePositiveNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.trunc(value);
}
