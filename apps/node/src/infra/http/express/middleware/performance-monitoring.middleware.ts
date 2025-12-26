/**
 * Performance Monitoring Middleware for API
 * Tracks request/response metrics, memory usage, and event loop lag
 */

import type { LoggerPort } from '@core-domain';
import type { NextFunction, Request, Response } from 'express';

interface PerformanceMetrics {
  requestCount: number;
  totalDurationMs: number;
  avgDurationMs: number;
  maxDurationMs: number;
  minDurationMs: number;
  bytesReceived: number;
  bytesSent: number;
  memoryUsageMB: number;
  eventLoopLagMs: number;
  slowRequestsCount: number; // Requests > 1000ms
}

export class PerformanceMonitoringMiddleware {
  private requestCount = 0;
  private totalDurationMs = 0;
  private maxDurationMs = 0;
  private minDurationMs = Infinity;
  private bytesReceived = 0;
  private bytesSent = 0;
  private slowRequestsCount = 0;
  private eventLoopLagMs = 0;
  private lastEventLoopCheck = Date.now();
  private lagIntervalId: NodeJS.Timeout | null = null;

  constructor(private readonly logger?: LoggerPort) {
    // Start event loop lag monitoring
    this.startEventLoopMonitoring();
  }

  /**
   * Start monitoring event loop lag
   * Measures how long it takes for a setTimeout callback to be executed
   */
  private startEventLoopMonitoring(): void {
    const measureLag = () => {
      const now = Date.now();
      const expectedDelay = 100; // Check every 100ms
      const actualDelay = now - this.lastEventLoopCheck;
      const lag = Math.max(0, actualDelay - expectedDelay);

      // Use exponential moving average to smooth out spikes
      this.eventLoopLagMs = this.eventLoopLagMs * 0.9 + lag * 0.1;

      if (lag > 50) {
        this.logger?.warn('[PERF] Event loop lag detected', {
          lagMs: lag.toFixed(2),
          avgLagMs: this.eventLoopLagMs.toFixed(2),
        });
      }

      this.lastEventLoopCheck = now;
    };

    this.lagIntervalId = setInterval(measureLag, 100);

    // Don't keep process alive just for this timer
    if (this.lagIntervalId.unref) {
      this.lagIntervalId.unref();
    }
  }

  /**
   * Stop event loop monitoring (call on server shutdown)
   */
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
      const startTime = Date.now();
      const startMemory = process.memoryUsage().heapUsed;

      // Estimate request size (headers + body)
      const requestSize =
        JSON.stringify(req.body || {}).length + JSON.stringify(req.headers).length;
      this.bytesReceived += requestSize;

      // Track response
      const originalSend = res.send.bind(res);
      const originalJson = res.json.bind(res);

      res.send = (body: unknown) => {
        this.bytesSent += typeof body === 'string' ? body.length : JSON.stringify(body).length;
        return originalSend(body);
      };

      res.json = (body: unknown) => {
        this.bytesSent += JSON.stringify(body).length;
        return originalJson(body);
      };

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const endMemory = process.memoryUsage().heapUsed;
        const memoryDelta = endMemory - startMemory;

        // Update metrics
        this.requestCount++;
        this.totalDurationMs += duration;
        this.maxDurationMs = Math.max(this.maxDurationMs, duration);
        this.minDurationMs = Math.min(this.minDurationMs, duration);

        if (duration > 1000) {
          this.slowRequestsCount++;
        }

        // Log slow requests or errors
        const shouldLog = duration > 500 || res.statusCode >= 400;

        if (shouldLog && this.logger) {
          this.logger.info('[PERF] Request completed', {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            durationMs: duration.toFixed(2),
            requestSizeBytes: requestSize,
            memoryDeltaMB: (memoryDelta / 1024 / 1024).toFixed(2),
            eventLoopLagMs: this.eventLoopLagMs.toFixed(2),
          });
        }
      });

      next();
    };
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const memUsage = process.memoryUsage();

    return {
      requestCount: this.requestCount,
      totalDurationMs: this.totalDurationMs,
      avgDurationMs: this.requestCount > 0 ? this.totalDurationMs / this.requestCount : 0,
      maxDurationMs: this.maxDurationMs === 0 ? 0 : this.maxDurationMs,
      minDurationMs: this.minDurationMs === Infinity ? 0 : this.minDurationMs,
      bytesReceived: this.bytesReceived,
      bytesSent: this.bytesSent,
      memoryUsageMB: memUsage.heapUsed / 1024 / 1024,
      eventLoopLagMs: this.eventLoopLagMs,
      slowRequestsCount: this.slowRequestsCount,
    };
  }

  /**
   * Generate a human-readable summary report
   */
  generateSummary(): string {
    const metrics = this.getMetrics();
    const memUsage = process.memoryUsage();

    const lines: string[] = ['=== API Performance Summary ==='];
    lines.push(`Total requests: ${metrics.requestCount}`);
    lines.push(`Average response time: ${metrics.avgDurationMs.toFixed(2)}ms`);
    lines.push(`Min response time: ${metrics.minDurationMs.toFixed(2)}ms`);
    lines.push(`Max response time: ${metrics.maxDurationMs.toFixed(2)}ms`);
    lines.push(`Slow requests (>1s): ${metrics.slowRequestsCount}`);
    lines.push('');
    lines.push(`Total bytes received: ${(metrics.bytesReceived / 1024 / 1024).toFixed(2)} MB`);
    lines.push(`Total bytes sent: ${(metrics.bytesSent / 1024 / 1024).toFixed(2)} MB`);
    lines.push('');
    lines.push(`Heap used: ${metrics.memoryUsageMB.toFixed(2)} MB`);
    lines.push(`Heap total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    lines.push(`External: ${(memUsage.external / 1024 / 1024).toFixed(2)} MB`);
    lines.push(`RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
    lines.push('');
    lines.push(`Event loop lag: ${metrics.eventLoopLagMs.toFixed(2)}ms (avg)`);

    // Warnings
    if (metrics.avgDurationMs > 500) {
      lines.push('');
      lines.push(`⚠️ WARNING: High average response time (${metrics.avgDurationMs.toFixed(2)}ms)`);
    }
    if (metrics.eventLoopLagMs > 100) {
      lines.push('');
      lines.push(`⚠️ WARNING: High event loop lag (${metrics.eventLoopLagMs.toFixed(2)}ms)`);
    }
    if (metrics.memoryUsageMB > 500) {
      lines.push('');
      lines.push(`⚠️ WARNING: High memory usage (${metrics.memoryUsageMB.toFixed(2)} MB)`);
    }

    return lines.join('\n');
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.requestCount = 0;
    this.totalDurationMs = 0;
    this.maxDurationMs = 0;
    this.minDurationMs = Infinity;
    this.bytesReceived = 0;
    this.bytesSent = 0;
    this.slowRequestsCount = 0;
    // Don't reset event loop lag as it's continuously measured
  }
}
