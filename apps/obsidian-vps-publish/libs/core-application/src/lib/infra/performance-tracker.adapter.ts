/**
 * Default implementation of PerformanceTrackerPort
 * Records timings and metrics for later analysis
 */

import type { LoggerPort } from '@core-domain/ports/logger-port';
import type {
  PerformanceMetrics,
  PerformanceTrackerPort,
} from '@core-domain/ports/performance-tracker.port';

interface ActiveSpan {
  name: string;
  startTime: number;
  metadata?: Record<string, unknown>;
}

interface RecordedMetric {
  name: string;
  metrics: PerformanceMetrics;
  timestamp: number;
}

export class PerformanceTrackerAdapter implements PerformanceTrackerPort {
  private activeSpans = new Map<string, ActiveSpan>();
  private recordedMetrics: RecordedMetric[] = [];
  private spanIdCounter = 0;
  private readonly prefix: string;

  constructor(
    private readonly logger?: LoggerPort,
    private readonly debugMode: boolean = false,
    prefix: string = ''
  ) {
    this.prefix = prefix;
  }

  startSpan(spanName: string, metadata?: Record<string, unknown>): string {
    const spanId = `span-${this.spanIdCounter++}`;
    const fullName = this.prefix ? `${this.prefix}.${spanName}` : spanName;

    this.activeSpans.set(spanId, {
      name: fullName,
      startTime: performance.now(),
      metadata,
    });

    if (this.debugMode) {
      this.logger?.debug(`[PERF] Started: ${fullName}`, metadata);
    }

    return spanId;
  }

  endSpan(spanId: string, counters?: Record<string, number>): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      this.logger?.warn(`[PERF] Attempted to end unknown span: ${spanId}`);
      return;
    }

    const endTime = performance.now();
    const durationMs = endTime - span.startTime;

    const metrics: PerformanceMetrics = {
      durationMs,
      counters,
      metadata: span.metadata,
    };

    this.recordedMetrics.push({
      name: span.name,
      metrics,
      timestamp: Date.now(),
    });

    if (this.debugMode || durationMs > 1000) {
      // Always log if > 1 second
      this.logger?.debug(`[PERF] Completed: ${span.name}`, {
        durationMs: durationMs.toFixed(2),
        durationSec: (durationMs / 1000).toFixed(2),
        ...counters,
      });
    }

    this.activeSpans.delete(spanId);
  }

  recordMetric(metricName: string, metrics: PerformanceMetrics): void {
    const fullName = this.prefix ? `${this.prefix}.${metricName}` : metricName;

    this.recordedMetrics.push({
      name: fullName,
      metrics,
      timestamp: Date.now(),
    });

    if (this.debugMode || metrics.durationMs > 1000) {
      this.logger?.debug(`[PERF] Metric: ${fullName}`, {
        durationMs: metrics.durationMs.toFixed(2),
        ...metrics.counters,
      });
    }
  }

  getMetrics(): Array<{ name: string; metrics: PerformanceMetrics }> {
    return this.recordedMetrics.map((r) => ({
      name: r.name,
      metrics: r.metrics,
    }));
  }

  reset(): void {
    this.activeSpans.clear();
    this.recordedMetrics = [];
    this.spanIdCounter = 0;
  }

  child(childPrefix: string): PerformanceTrackerPort {
    const fullPrefix = this.prefix ? `${this.prefix}.${childPrefix}` : childPrefix;
    return new PerformanceTrackerAdapter(this.logger, this.debugMode, fullPrefix);
  }

  /**
   * Generate a summary report of all recorded metrics
   * Useful for end-of-session diagnostics
   */
  generateSummary(): string {
    if (this.recordedMetrics.length === 0) {
      return 'No performance metrics recorded.';
    }

    const lines: string[] = ['=== Performance Summary ==='];

    // Group by metric name
    const grouped = new Map<string, PerformanceMetrics[]>();
    for (const record of this.recordedMetrics) {
      const existing = grouped.get(record.name) || [];
      existing.push(record.metrics);
      grouped.set(record.name, existing);
    }

    // Sort by total time descending
    const sorted = Array.from(grouped.entries()).sort((a, b) => {
      const totalA = a[1].reduce((sum, m) => sum + m.durationMs, 0);
      const totalB = b[1].reduce((sum, m) => sum + m.durationMs, 0);
      return totalB - totalA;
    });

    for (const [name, metricsList] of sorted) {
      const count = metricsList.length;
      const totalMs = metricsList.reduce((sum, m) => sum + m.durationMs, 0);
      const avgMs = totalMs / count;

      lines.push(`  ${name}: ${totalMs.toFixed(0)}ms total (${count}x, avg ${avgMs.toFixed(0)}ms)`);

      // Aggregate counters if present
      const allCounters = metricsList.flatMap((m) =>
        m.counters ? Object.entries(m.counters) : []
      );
      if (allCounters.length > 0) {
        const counterSums = new Map<string, number>();
        for (const [key, value] of allCounters) {
          counterSums.set(key, (counterSums.get(key) || 0) + value);
        }
        const counterStr = Array.from(counterSums.entries())
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');
        lines.push(`    → ${counterStr}`);
      }
    }

    return lines.join('\n');
  }
}
