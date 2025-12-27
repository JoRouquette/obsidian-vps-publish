import { type LoggerPort } from '@core-domain';
import { type Request, type Response, Router } from 'express';

import type { BackpressureMiddleware } from '../middleware/backpressure.middleware';
import type { PerformanceMonitoringMiddleware } from '../middleware/performance-monitoring.middleware';

export interface HealthCheckDependencies {
  backpressure?: BackpressureMiddleware;
  perfMonitor?: PerformanceMonitoringMiddleware;
}

export function createHealthCheckController(
  deps?: HealthCheckDependencies,
  logger?: LoggerPort
): Router {
  logger = logger?.child({ module: 'HealthCheckController' });

  const router = Router();

  router.get('/health', (req: Request, res: Response) => {
    logger?.debug('Health check requested');

    const memUsage = process.memoryUsage();
    const loadMetrics = deps?.backpressure?.getLoadMetrics();
    const perfMetrics = deps?.perfMonitor?.getMetrics();

    const health = {
      status: loadMetrics?.isUnderPressure ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        heapUsedMB: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
        heapTotalMB: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
        rssMB: (memUsage.rss / 1024 / 1024).toFixed(2),
        externalMB: (memUsage.external / 1024 / 1024).toFixed(2),
      },
      load: loadMetrics
        ? {
            activeRequests: loadMetrics.activeRequests,
            eventLoopLagMs: parseFloat(loadMetrics.eventLoopLagMs.toFixed(2)),
            memoryUsageMB: parseFloat(loadMetrics.memoryUsageMB.toFixed(2)),
            isUnderPressure: loadMetrics.isUnderPressure,
            rejections: loadMetrics.rejections,
          }
        : undefined,
      performance: perfMetrics
        ? {
            requestCount: perfMetrics.requestCount,
            avgDurationMs: parseFloat(perfMetrics.avgDurationMs.toFixed(2)),
            maxDurationMs: parseFloat(perfMetrics.maxDurationMs.toFixed(2)),
            minDurationMs:
              perfMetrics.minDurationMs === Infinity
                ? 0
                : parseFloat(perfMetrics.minDurationMs.toFixed(2)),
            slowRequestsCount: perfMetrics.slowRequestsCount,
          }
        : undefined,
    };

    logger?.debug('Health check response', { health });

    return res.status(loadMetrics?.isUnderPressure ? 503 : 200).json(health);
  });

  return router;
}
