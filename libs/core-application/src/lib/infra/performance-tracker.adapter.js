"use strict";
/**
 * Default implementation of PerformanceTrackerPort
 * Records timings and metrics for later analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceTrackerAdapter = void 0;
class PerformanceTrackerAdapter {
    constructor(logger, debugMode = false, prefix = '') {
        this.logger = logger;
        this.debugMode = debugMode;
        this.activeSpans = new Map();
        this.recordedMetrics = [];
        this.spanIdCounter = 0;
        this.prefix = prefix;
    }
    startSpan(spanName, metadata) {
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
    endSpan(spanId, counters) {
        const span = this.activeSpans.get(spanId);
        if (!span) {
            this.logger?.warn(`[PERF] Attempted to end unknown span: ${spanId}`);
            return;
        }
        const endTime = performance.now();
        const durationMs = endTime - span.startTime;
        const metrics = {
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
    recordMetric(metricName, metrics) {
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
    getMetrics() {
        return this.recordedMetrics.map((r) => ({
            name: r.name,
            metrics: r.metrics,
        }));
    }
    reset() {
        this.activeSpans.clear();
        this.recordedMetrics = [];
        this.spanIdCounter = 0;
    }
    child(childPrefix) {
        const fullPrefix = this.prefix ? `${this.prefix}.${childPrefix}` : childPrefix;
        return new PerformanceTrackerAdapter(this.logger, this.debugMode, fullPrefix);
    }
    /**
     * Generate a summary report of all recorded metrics
     * Useful for end-of-session diagnostics
     */
    generateSummary() {
        if (this.recordedMetrics.length === 0) {
            return 'No performance metrics recorded.';
        }
        const lines = ['=== Performance Summary ==='];
        // Group by metric name
        const grouped = new Map();
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
            const allCounters = metricsList.flatMap((m) => m.counters ? Object.entries(m.counters) : []);
            if (allCounters.length > 0) {
                const counterSums = new Map();
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
exports.PerformanceTrackerAdapter = PerformanceTrackerAdapter;
