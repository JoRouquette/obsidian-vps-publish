/**
 * UI Pressure Monitor
 * Tracks UI responsiveness metrics during publishing operations
 * Helps identify blocking operations and excessive UI updates
 */

import type { LoggerPort } from '@core-domain/ports/logger-port';

export interface UiPressureMetrics {
  /** Total number of progress updates sent */
  totalProgressUpdates: number;
  /** Total number of notices created */
  totalNoticesCreated: number;
  /** Number of progress updates in the last second */
  progressUpdatesPerSecond: number;
  /** Number of notices created in the last second */
  noticesPerSecond: number;
  /** Average time between progress updates (ms) */
  avgProgressUpdateIntervalMs: number;
  /** Longest blocking operation detected (ms) */
  longestBlockMs: number;
  /** Number of blocking operations detected (>50ms) */
  blockingOperationsCount: number;
  /** List of timestamps when blocking operations occurred */
  blockingOperations: Array<{ timestampMs: number; durationMs: number; context?: string }>;
}

export class UiPressureMonitorAdapter {
  private totalProgressUpdates = 0;
  private totalNoticesCreated = 0;
  private progressUpdateTimestamps: number[] = [];
  private noticeTimestamps: number[] = [];
  private blockingOperations: Array<{ timestampMs: number; durationMs: number; context?: string }> =
    [];
  private longestBlockMs = 0;
  private lastOperationTimestamp: number = performance.now();
  private readonly blockingThresholdMs: number;

  constructor(
    private readonly logger?: LoggerPort,
    blockingThresholdMs: number = 50 // Operations longer than this are considered blocking
  ) {
    this.blockingThresholdMs = blockingThresholdMs;
  }

  /**
   * Record a progress update (call this every time progress bar is updated)
   */
  recordProgressUpdate(): void {
    const now = performance.now();
    this.totalProgressUpdates++;
    this.progressUpdateTimestamps.push(now);

    // Keep only last 2 seconds of timestamps
    const cutoff = now - 2000;
    this.progressUpdateTimestamps = this.progressUpdateTimestamps.filter((ts) => ts > cutoff);
  }

  /**
   * Record a notice creation (call this every time a Notice is created)
   */
  recordNoticeCreated(): void {
    const now = performance.now();
    this.totalNoticesCreated++;
    this.noticeTimestamps.push(now);

    // Keep only last 2 seconds of timestamps
    const cutoff = now - 2000;
    this.noticeTimestamps = this.noticeTimestamps.filter((ts) => ts > cutoff);
  }

  /**
   * Mark the start of a potentially blocking operation
   * Returns a function to call when operation completes
   */
  startOperation(context?: string): () => void {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const durationMs = endTime - startTime;

      if (durationMs > this.blockingThresholdMs) {
        this.blockingOperations.push({
          timestampMs: startTime,
          durationMs,
          context,
        });

        if (durationMs > this.longestBlockMs) {
          this.longestBlockMs = durationMs;
        }

        if (this.logger) {
          this.logger.warn(
            `[UI PRESSURE] Blocking operation detected: ${durationMs.toFixed(2)}ms`,
            {
              context,
              threshold: this.blockingThresholdMs,
            }
          );
        }
      }

      this.lastOperationTimestamp = endTime;
    };
  }

  /**
   * Get current UI pressure metrics
   */
  getMetrics(): UiPressureMetrics {
    const now = performance.now();
    const oneSecondAgo = now - 1000;

    // Count updates in last second
    const recentProgressUpdates = this.progressUpdateTimestamps.filter((ts) => ts > oneSecondAgo);
    const recentNotices = this.noticeTimestamps.filter((ts) => ts > oneSecondAgo);

    // Calculate average interval between progress updates
    let avgProgressUpdateIntervalMs = 0;
    if (this.progressUpdateTimestamps.length > 1) {
      const intervals: number[] = [];
      for (let i = 1; i < this.progressUpdateTimestamps.length; i++) {
        intervals.push(this.progressUpdateTimestamps[i] - this.progressUpdateTimestamps[i - 1]);
      }
      avgProgressUpdateIntervalMs = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    }

    return {
      totalProgressUpdates: this.totalProgressUpdates,
      totalNoticesCreated: this.totalNoticesCreated,
      progressUpdatesPerSecond: recentProgressUpdates.length,
      noticesPerSecond: recentNotices.length,
      avgProgressUpdateIntervalMs,
      longestBlockMs: this.longestBlockMs,
      blockingOperationsCount: this.blockingOperations.length,
      blockingOperations: [...this.blockingOperations], // Clone to prevent external mutation
    };
  }

  /**
   * Generate a human-readable summary report
   */
  generateSummary(): string {
    const metrics = this.getMetrics();
    const lines: string[] = ['=== UI Pressure Summary ==='];

    lines.push(`Total progress updates: ${metrics.totalProgressUpdates}`);
    lines.push(`Total notices created: ${metrics.totalNoticesCreated}`);

    if (metrics.totalProgressUpdates > 0) {
      lines.push(
        `Average progress update interval: ${metrics.avgProgressUpdateIntervalMs.toFixed(2)}ms`
      );
      lines.push(
        `Current progress updates/sec: ${metrics.progressUpdatesPerSecond} (last 1 second window)`
      );
    }

    if (metrics.totalNoticesCreated > 0) {
      lines.push(`Current notices/sec: ${metrics.noticesPerSecond} (last 1 second window)`);
    }

    lines.push('');
    lines.push(`Blocking operations detected: ${metrics.blockingOperationsCount}`);

    if (metrics.blockingOperationsCount > 0) {
      lines.push(`Longest blocking operation: ${metrics.longestBlockMs.toFixed(2)}ms`);
      lines.push('');
      lines.push('Top 5 longest blocking operations:');

      const sortedBlocks = [...metrics.blockingOperations]
        .sort((a, b) => b.durationMs - a.durationMs)
        .slice(0, 5);

      for (const block of sortedBlocks) {
        const contextStr = block.context ? ` (${block.context})` : '';
        lines.push(`  - ${block.durationMs.toFixed(2)}ms${contextStr}`);
      }
    }

    // Warnings
    lines.push('');
    if (metrics.progressUpdatesPerSecond > 10) {
      lines.push(`⚠️ WARNING: High progress update rate (${metrics.progressUpdatesPerSecond}/sec)`);
    }
    if (metrics.noticesPerSecond > 2) {
      lines.push(`⚠️ WARNING: High notice creation rate (${metrics.noticesPerSecond}/sec)`);
    }
    if (metrics.longestBlockMs > 100) {
      lines.push(
        `⚠️ WARNING: Very long blocking operation detected (${metrics.longestBlockMs.toFixed(2)}ms)`
      );
    }

    return lines.join('\n');
  }

  /**
   * Reset all metrics (useful for testing or between publishing sessions)
   */
  reset(): void {
    this.totalProgressUpdates = 0;
    this.totalNoticesCreated = 0;
    this.progressUpdateTimestamps = [];
    this.noticeTimestamps = [];
    this.blockingOperations = [];
    this.longestBlockMs = 0;
    this.lastOperationTimestamp = performance.now();
  }
}
