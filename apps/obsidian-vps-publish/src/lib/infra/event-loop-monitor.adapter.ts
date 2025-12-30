import type { LoggerPort } from '@core-domain/ports/logger-port';

/**
 * Event Loop Lag Monitor
 *
 * Measures the drift/lag of the JavaScript event loop to detect UI freezes.
 * Uses a high-frequency setInterval timer to measure the time between expected
 * and actual callback executions.
 *
 * High lag values indicate the event loop is blocked, causing UI freezes.
 */
export class EventLoopMonitorAdapter {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private lastCheckTime = 0;
  private lagSamples: number[] = [];
  private readonly checkIntervalMs: number;
  private readonly logger: LoggerPort;
  private isRunning = false;

  /**
   * @param checkIntervalMs Interval at which to check lag (default: 100ms)
   * @param logger Logger instance
   */
  constructor(logger: LoggerPort, checkIntervalMs = 100) {
    this.logger = logger;
    this.checkIntervalMs = checkIntervalMs;
  }

  /**
   * Start monitoring event loop lag
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Event loop monitor already running');
      return;
    }

    this.isRunning = true;
    this.lagSamples = [];
    this.lastCheckTime = Date.now();

    // Use globalThis for cross-environment compatibility (Node.js + Browser)
    this.intervalHandle = globalThis.setInterval(() => {
      const now = Date.now();
      const expectedTime = this.lastCheckTime + this.checkIntervalMs;
      const drift = now - expectedTime;

      // Only record positive drift (lag) - negative means we're ahead
      if (drift > 0) {
        this.lagSamples.push(drift);
      }

      this.lastCheckTime = now;
    }, this.checkIntervalMs);

    this.logger.debug('Event loop monitor started', {
      checkIntervalMs: this.checkIntervalMs,
    });
  }

  /**
   * Stop monitoring and return statistics
   */
  stop(): EventLoopStats {
    if (!this.isRunning) {
      this.logger.warn('Event loop monitor not running');
      return {
        samples: 0,
        minLagMs: 0,
        maxLagMs: 0,
        avgLagMs: 0,
        p50LagMs: 0,
        p95LagMs: 0,
        p99LagMs: 0,
      };
    }

    if (this.intervalHandle !== null) {
      globalThis.clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    this.isRunning = false;

    const stats = this.computeStats();
    this.logger.debug('Event loop monitor stopped', {
      samples: stats.samples,
      minLagMs: stats.minLagMs,
      maxLagMs: stats.maxLagMs,
      avgLagMs: stats.avgLagMs,
      p50LagMs: stats.p50LagMs,
      p95LagMs: stats.p95LagMs,
      p99LagMs: stats.p99LagMs,
    });

    return stats;
  }

  /**
   * Get current statistics without stopping
   */
  getStats(): EventLoopStats {
    return this.computeStats();
  }

  private computeStats(): EventLoopStats {
    if (this.lagSamples.length === 0) {
      return {
        samples: 0,
        minLagMs: 0,
        maxLagMs: 0,
        avgLagMs: 0,
        p50LagMs: 0,
        p95LagMs: 0,
        p99LagMs: 0,
      };
    }

    const sorted = [...this.lagSamples].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    return {
      samples: sorted.length,
      minLagMs: sorted[0],
      maxLagMs: sorted[sorted.length - 1],
      avgLagMs: sum / sorted.length,
      p50LagMs: this.percentile(sorted, 50),
      p95LagMs: this.percentile(sorted, 95),
      p99LagMs: this.percentile(sorted, 99),
    };
  }

  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }
}

export interface EventLoopStats {
  samples: number;
  minLagMs: number;
  maxLagMs: number;
  avgLagMs: number;
  p50LagMs: number;
  p95LagMs: number;
  p99LagMs: number;
}
