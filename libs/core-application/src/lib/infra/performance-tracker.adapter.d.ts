/**
 * Default implementation of PerformanceTrackerPort
 * Records timings and metrics for later analysis
 */
import type { LoggerPort } from '@core-domain/ports/logger-port';
import type { PerformanceMetrics, PerformanceTrackerPort } from '@core-domain/ports/performance-tracker.port';
export declare class PerformanceTrackerAdapter implements PerformanceTrackerPort {
    private readonly logger?;
    private readonly debugMode;
    private activeSpans;
    private recordedMetrics;
    private spanIdCounter;
    private readonly prefix;
    constructor(logger?: LoggerPort | undefined, debugMode?: boolean, prefix?: string);
    startSpan(spanName: string, metadata?: Record<string, unknown>): string;
    endSpan(spanId: string, counters?: Record<string, number>): void;
    recordMetric(metricName: string, metrics: PerformanceMetrics): void;
    getMetrics(): Array<{
        name: string;
        metrics: PerformanceMetrics;
    }>;
    reset(): void;
    child(childPrefix: string): PerformanceTrackerPort;
    /**
     * Generate a summary report of all recorded metrics
     * Useful for end-of-session diagnostics
     */
    generateSummary(): string;
}
//# sourceMappingURL=performance-tracker.adapter.d.ts.map