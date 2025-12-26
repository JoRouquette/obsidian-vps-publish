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
      // Check active requests
      if (this.activeRequests >= this.config.maxActiveRequests) {
        this.logger?.warn('[BACKPRESSURE] Too many active requests', {
          activeRequests: this.activeRequests,
          maxActiveRequests: this.config.maxActiveRequests,
        });
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Server is under high load, please retry later',
          retryAfterMs: 5000,
        });
      }

      // Check event loop lag
      if (this.eventLoopLagMs > this.config.maxEventLoopLagMs) {
        this.logger?.warn('[BACKPRESSURE] High event loop lag', {
          eventLoopLagMs: this.eventLoopLagMs.toFixed(2),
          maxEventLoopLagMs: this.config.maxEventLoopLagMs,
        });
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Server is under high load (event loop lag)',
          retryAfterMs: 5000,
        });
      }

      // Check memory usage
      const memUsageMB = process.memoryUsage().heapUsed / 1024 / 1024;
      if (memUsageMB > this.config.maxMemoryUsageMB) {
        this.logger?.warn('[BACKPRESSURE] High memory usage', {
          memoryUsageMB: memUsageMB.toFixed(2),
          maxMemoryUsageMB: this.config.maxMemoryUsageMB,
        });
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Server is under high load (memory)',
          retryAfterMs: 10000, // Longer retry for memory issues
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
