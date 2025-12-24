/**
 * Port for performance tracking and instrumentation
 * Allows measuring durations, counting operations, and tracking metrics
 * without coupling to specific implementation (console, telemetry service, etc.)
 */

export interface PerformanceMetrics {
  /** Elapsed time in milliseconds */
  durationMs: number;

  /** Optional counter metrics (e.g., items processed, bytes transferred) */
  counters?: Record<string, number>;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

export interface PerformanceTrackerPort {
  /**
   * Start a new performance span/timer
   * @param spanName - Identifier for this measurement
   * @param metadata - Optional contextual data
   * @returns Span ID for ending the measurement
   */
  startSpan(spanName: string, metadata?: Record<string, unknown>): string;

  /**
   * End a performance span and record metrics
   * @param spanId - ID returned from startSpan
   * @param counters - Optional counter metrics to record
   */
  endSpan(spanId: string, counters?: Record<string, number>): void;

  /**
   * Record a metric without explicit span (convenience method)
   * @param metricName - Name of the metric
   * @param metrics - Performance metrics to record
   */
  recordMetric(metricName: string, metrics: PerformanceMetrics): void;

  /**
   * Get all recorded metrics (for reporting/debugging)
   * @returns Array of all recorded measurements
   */
  getMetrics(): Array<{
    name: string;
    metrics: PerformanceMetrics;
  }>;

  /**
   * Clear all recorded metrics
   */
  reset(): void;

  /**
   * Create a child tracker with prefixed names
   * @param prefix - Prefix for all child spans/metrics
   */
  child(prefix: string): PerformanceTrackerPort;
}
