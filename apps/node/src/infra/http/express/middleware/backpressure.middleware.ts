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

/**
 * Tells whether a request is a finalization stream carrying a token valid for
 * its session and job. Built next to the stream controller, which owns the
 * route and the token check.
 */
export type FinalizationStreamAuthorizer = (req: Request) => boolean;

export class BackpressureMiddleware {
  private finalizationStreamAuthorizer: FinalizationStreamAuthorizer | null = null;
  private activeRequests = 0;
  private eventLoopLagMs = 0;
  private lastEventLoopCheck = Date.now();
  private lagIntervalId: NodeJS.Timeout | null = null;
  private config: BackpressureConfig;

  // Metrics counters for diagnostics
  private rejectionCounters = {
    active_requests: 0,
    event_loop_lag: 0,
    memory_pressure: 0,
  };

  constructor(
    config: BackpressureConfig = DEFAULT_CONFIG,
    private readonly logger?: LoggerPort
  ) {
    this.config = { ...config };
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

  /**
   * Enables the finalization stream exemptions. Until an authorizer is set, the
   * stream is shed like any other request.
   */
  authorizeFinalizationStreams(authorizer: FinalizationStreamAuthorizer): void {
    this.finalizationStreamAuthorizer = authorizer;
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

      // An authenticated finalization stream is exempt from two shedding causes,
      // not three. Authenticated means a stream token valid for its session and
      // job: the Accept header and the path alone are client-controlled, and would
      // let anyone skip the shedding.
      //
      // Active requests: the stream lives for the whole finalization, so counting
      // it would hold a slot for minutes.
      //
      // Event loop lag: refusing the stream does not relieve the loop, since the
      // finalization it reports on keeps running whether or not someone listens.
      // What a refusal does cost is visibility: an EventSource never exposes the
      // HTTP status to JavaScript, so the plugin sees a 429 exactly as it would
      // see a dead server, and can only fall back to status polling.
      //
      // Memory pressure is deliberately NOT exempt. It is the last guard against an
      // out-of-memory kill on hosts that often run without swap, and admitting one
      // more stream adds buffers the heap cannot afford. The plugin's polling
      // fallback, with its back-off, is the right answer there.
      //
      // Accepted risk: the token is a bearer token, valid for its lifetime and not
      // single-use, so whoever holds it can open several exempt streams for the
      // same job. Holding it already requires the API key or a leaked URL.
      //
      // Evaluated lazily and at most once per request. An ordinary request stops
      // at the method and Accept checks and never reaches the token's HMAC, and
      // memory pressure alone rejects before the token is needed. A stream that
      // passes every threshold is still checked once, to keep it uncounted.
      let authorizedStream: boolean | undefined;
      const isAuthorizedStream = (): boolean =>
        (authorizedStream ??= this.isAuthorizedFinalizationStream(req));

      // Check active requests
      if (this.activeRequests >= this.config.maxActiveRequests && !isAuthorizedStream()) {
        this.rejectionCounters.active_requests++;
        const retryAfterMs = 5000;
        this.logger?.warn('[BACKPRESSURE] Too many active requests', {
          requestId,
          activeRequests: this.activeRequests,
          maxActiveRequests: this.config.maxActiveRequests,
          cause: 'active_requests',
          source: 'app',
          totalRejections: this.rejectionCounters.active_requests,
        });
        return res
          .status(429)
          .header('Retry-After', Math.ceil(retryAfterMs / 1000).toString())
          .header('X-App-Instance', 'backend-api')
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
      if (this.eventLoopLagMs > this.config.maxEventLoopLagMs && !isAuthorizedStream()) {
        this.rejectionCounters.event_loop_lag++;
        const retryAfterMs = 5000;
        this.logger?.warn('[BACKPRESSURE] High event loop lag', {
          requestId,
          eventLoopLagMs: this.eventLoopLagMs.toFixed(2),
          maxEventLoopLagMs: this.config.maxEventLoopLagMs,
          cause: 'event_loop_lag',
          source: 'app',
          totalRejections: this.rejectionCounters.event_loop_lag,
        });
        return res
          .status(429)
          .header('Retry-After', Math.ceil(retryAfterMs / 1000).toString())
          .header('X-App-Instance', 'backend-api')
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
        this.rejectionCounters.memory_pressure++;
        const retryAfterMs = 10000; // Longer retry for memory issues
        this.logger?.warn('[BACKPRESSURE] High memory usage', {
          requestId,
          memoryUsageMB: memUsageMB.toFixed(2),
          maxMemoryUsageMB: this.config.maxMemoryUsageMB,
          cause: 'memory_pressure',
          source: 'app',
          totalRejections: this.rejectionCounters.memory_pressure,
        });
        return res
          .status(429)
          .header('Retry-After', Math.ceil(retryAfterMs / 1000).toString())
          .header('X-App-Instance', 'backend-api')
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
      if (!isAuthorizedStream()) {
        this.activeRequests++;
        let released = false;
        const release = () => {
          if (released) {
            return;
          }

          released = true;
          this.activeRequests--;
        };

        res.on('finish', release);
        res.on('close', release);
      }

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
      rejections: {
        active_requests: this.rejectionCounters.active_requests,
        event_loop_lag: this.rejectionCounters.event_loop_lag,
        memory_pressure: this.rejectionCounters.memory_pressure,
        total:
          this.rejectionCounters.active_requests +
          this.rejectionCounters.event_loop_lag +
          this.rejectionCounters.memory_pressure,
      },
      isUnderPressure:
        this.activeRequests >= this.config.maxActiveRequests ||
        this.eventLoopLagMs > this.config.maxEventLoopLagMs ||
        memUsageMB > this.config.maxMemoryUsageMB,
    };
  }

  getConfig(): BackpressureConfig {
    return { ...this.config };
  }

  updateConfig(nextConfig: Partial<BackpressureConfig>): BackpressureConfig {
    this.config = {
      maxActiveRequests:
        this.normalizePositiveNumber(nextConfig.maxActiveRequests) ?? this.config.maxActiveRequests,
      maxEventLoopLagMs:
        this.normalizePositiveNumber(nextConfig.maxEventLoopLagMs) ?? this.config.maxEventLoopLagMs,
      maxMemoryUsageMB:
        this.normalizePositiveNumber(nextConfig.maxMemoryUsageMB) ?? this.config.maxMemoryUsageMB,
    };

    return this.getConfig();
  }

  resetRejectionCounters(): void {
    this.rejectionCounters = {
      active_requests: 0,
      event_loop_lag: 0,
      memory_pressure: 0,
    };
  }

  private normalizePositiveNumber(value: number | undefined): number | null {
    return Number.isFinite(value) && (value ?? 0) > 0 ? (value ?? null) : null;
  }

  // The cheap checks come first, so an ordinary request never reaches the
  // authorizer and its HMAC.
  private isAuthorizedFinalizationStream(req: Request): boolean {
    if (!this.finalizationStreamAuthorizer || req.method !== 'GET') {
      return false;
    }

    const accept = req.headers?.accept;
    if (typeof accept !== 'string' || !accept.includes('text/event-stream')) {
      return false;
    }

    return this.finalizationStreamAuthorizer(req);
  }
}
