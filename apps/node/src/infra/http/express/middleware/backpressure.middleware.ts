/**
 * Backpressure Middleware for API
 * Rejects requests when server is under high load
 *
 * Triggers backpressure based on:
 * - Event loop lag > threshold
 * - Memory usage > threshold
 * - Active requests > threshold
 */

import type { LoggerPort } from '@core-domain';
import type { NextFunction, Request, Response } from 'express';

export interface BackpressureConfig {
  maxEventLoopLagMs: number; // Reject if event loop lag exceeds this
  maxMemoryUsageMB: number; // Reject if heap usage exceeds this
  maxActiveRequests: number; // Reject if concurrent requests exceed this
}

const DEFAULT_CONFIG: BackpressureConfig = {
  maxEventLoopLagMs: 200, // 200ms lag = severe congestion
  maxMemoryUsageMB: 500, // 500MB heap usage
  maxActiveRequests: 50, // Max 50 concurrent requests
};

export class BackpressureMiddleware {
  private activeRequests = 0;
  private eventLoopLagMs = 0;
  private lastEventLoopCheck = Date.now();
  private lagIntervalId: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: BackpressureConfig = DEFAULT_CONFIG,
    private readonly logger?: LoggerPort
  ) {
    this.startEventLoopMonitoring();
  }

  /**
   * Monitor event loop lag
   */
  private startEventLoopMonitoring(): void {
    const measureLag = () => {
      const now = Date.now();
      const expectedDelay = 100;
      const actualDelay = now - this.lastEventLoopCheck;
      const lag = Math.max(0, actualDelay - expectedDelay);

      // Exponential moving average
      this.eventLoopLagMs = this.eventLoopLagMs * 0.9 + lag * 0.1;
      this.lastEventLoopCheck = now;
    };

    this.lagIntervalId = setInterval(measureLag, 100);
    if (this.lagIntervalId.unref) {
      this.lagIntervalId.unref();
    }
  }

  stopEventLoopMonitoring(): void {
    if (this.lagIntervalId) {
      clearInterval(this.lagIntervalId);
      this.lagIntervalId = null;
    }
  }

  /**
   * Express middleware handler
   */
  handle() {
    return (req: Request, res: Response, next: NextFunction) => {
      const requestId = (req as Request & { requestId?: string }).requestId || 'unknown';

      // Check active requests
      if (this.activeRequests >= this.config.maxActiveRequests) {
        const retryAfterMs = 5000;
        this.logger?.warn('[BACKPRESSURE] Too many active requests', {
          requestId,
          activeRequests: this.activeRequests,
          maxActiveRequests: this.config.maxActiveRequests,
          cause: 'active_requests',
          source: 'app',
        });
        return res
          .status(429)
          .header('Retry-After', Math.ceil(retryAfterMs / 1000).toString())
          .header('X-RateLimit-Limit', this.config.maxActiveRequests.toString())
          .header('X-RateLimit-Remaining', '0')
          .header('X-RateLimit-Reset', new Date(Date.now() + retryAfterMs).toISOString())
          .json({
            error: 'Too Many Requests',
            message: 'Server is under high load, please retry later',
            retryAfterMs,
            cause: 'active_requests',
            source: 'app',
            requestId,
          });
      }

      // Check event loop lag
      if (this.eventLoopLagMs > this.config.maxEventLoopLagMs) {
        const retryAfterMs = 5000;
        this.logger?.warn('[BACKPRESSURE] High event loop lag', {
          requestId,
          eventLoopLagMs: this.eventLoopLagMs.toFixed(2),
          maxEventLoopLagMs: this.config.maxEventLoopLagMs,
          cause: 'event_loop_lag',
          source: 'app',
        });
        return res
          .status(429)
          .header('Retry-After', Math.ceil(retryAfterMs / 1000).toString())
          .header('X-RateLimit-Cause', 'event_loop_lag')
          .json({
            error: 'Too Many Requests',
            message: 'Server is under high load (event loop lag)',
            retryAfterMs,
            cause: 'event_loop_lag',
            source: 'app',
            requestId,
          });
      }

      // Check memory usage
      const memUsageMB = process.memoryUsage().heapUsed / 1024 / 1024;
      if (memUsageMB > this.config.maxMemoryUsageMB) {
        const retryAfterMs = 10000; // Longer retry for memory issues
        this.logger?.warn('[BACKPRESSURE] High memory usage', {
          requestId,
          memoryUsageMB: memUsageMB.toFixed(2),
          maxMemoryUsageMB: this.config.maxMemoryUsageMB,
          cause: 'memory_pressure',
          source: 'app',
        });
        return res
          .status(429)
          .header('Retry-After', Math.ceil(retryAfterMs / 1000).toString())
          .header('X-RateLimit-Cause', 'memory_pressure')
          .json({
            error: 'Too Many Requests',
            message: 'Server is under high load (memory)',
            retryAfterMs,
            cause: 'memory_pressure',
            source: 'app',
            requestId,
          });
      }

      // Track active requests
      this.activeRequests++;

      res.on('finish', () => {
        this.activeRequests--;
      });

      res.on('close', () => {
        // Client disconnected before response finished
        this.activeRequests--;
      });

      next();
    };
  }

  /**
   * Get current load metrics
   */
  getLoadMetrics() {
    const memUsageMB = process.memoryUsage().heapUsed / 1024 / 1024;
    return {
      activeRequests: this.activeRequests,
      eventLoopLagMs: this.eventLoopLagMs,
      memoryUsageMB: memUsageMB,
      isUnderPressure:
        this.activeRequests >= this.config.maxActiveRequests ||
        this.eventLoopLagMs > this.config.maxEventLoopLagMs ||
        memUsageMB > this.config.maxMemoryUsageMB,
    };
  }
}
