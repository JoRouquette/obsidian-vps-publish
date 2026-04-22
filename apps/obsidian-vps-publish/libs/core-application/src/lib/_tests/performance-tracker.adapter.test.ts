import { PerformanceTrackerAdapter } from '../infra/performance-tracker.adapter';

describe('PerformanceTrackerAdapter', () => {
  it('should track span duration', () => {
    const tracker = new PerformanceTrackerAdapter(undefined, false);

    const spanId = tracker.startSpan('test-operation');

    // Simulate some work
    for (let i = 0; i < 1000000; i++) {
      Math.sqrt(i);
    }

    tracker.endSpan(spanId, { itemsProcessed: 100 });

    const metrics = tracker.getMetrics();
    expect(metrics.length).toBe(1);
    expect(metrics[0].name).toBe('test-operation');
    expect(metrics[0].metrics.durationMs).toBeGreaterThan(0);
    expect(metrics[0].metrics.counters).toEqual({ itemsProcessed: 100 });
  });

  it('should track multiple spans', () => {
    const tracker = new PerformanceTrackerAdapter(undefined, false);

    const span1 = tracker.startSpan('operation-1');
    tracker.endSpan(span1, { count: 10 });

    const span2 = tracker.startSpan('operation-2');
    tracker.endSpan(span2, { count: 20 });

    const metrics = tracker.getMetrics();
    expect(metrics.length).toBe(2);
    expect(metrics[0].name).toBe('operation-1');
    expect(metrics[1].name).toBe('operation-2');
  });

  it('should handle nested spans (child prefix)', () => {
    const parent = new PerformanceTrackerAdapter(undefined, false);
    const child = parent.child('sub-process');

    const spanId = child.startSpan('step-1');
    child.endSpan(spanId);

    // Child tracker is independent, check its own metrics
    const childMetrics = child.getMetrics();
    expect(childMetrics.length).toBe(1);
    expect(childMetrics[0].name).toBe('sub-process.step-1');
  });

  it('should record metric directly', () => {
    const tracker = new PerformanceTrackerAdapter(undefined, false);

    tracker.recordMetric('direct-metric', {
      durationMs: 123.45,
      counters: { items: 50 },
    });

    const metrics = tracker.getMetrics();
    expect(metrics.length).toBe(1);
    expect(metrics[0].name).toBe('direct-metric');
    expect(metrics[0].metrics.durationMs).toBe(123.45);
  });

  it('should reset metrics', () => {
    const tracker = new PerformanceTrackerAdapter(undefined, false);

    const span1 = tracker.startSpan('operation');
    tracker.endSpan(span1);

    expect(tracker.getMetrics().length).toBe(1);

    tracker.reset();

    expect(tracker.getMetrics().length).toBe(0);
  });

  it('should generate summary report', () => {
    const tracker = new PerformanceTrackerAdapter(undefined, false);

    // Record multiple operations
    tracker.recordMetric('parse', { durationMs: 150, counters: { notes: 100 } });
    tracker.recordMetric('parse', { durationMs: 200, counters: { notes: 50 } });
    tracker.recordMetric('upload', { durationMs: 500, counters: { bytes: 1024000 } });

    const summary = tracker.generateSummary();

    expect(summary).toContain('Performance Summary');
    expect(summary).toContain('parse');
    expect(summary).toContain('upload');
    expect(summary).toContain('350ms total'); // 150 + 200
    expect(summary).toContain('2x'); // parse called 2 times
  });

  it('should handle empty metrics gracefully', () => {
    const tracker = new PerformanceTrackerAdapter(undefined, false);

    const summary = tracker.generateSummary();

    expect(summary).toContain('No performance metrics recorded');
  });

  it('should handle unknown span ID', () => {
    const mockLogger = {
      warn: jest.fn(),
      debug: jest.fn(),
      child: jest.fn().mockReturnThis(),
    };

    const tracker = new PerformanceTrackerAdapter(mockLogger as any, false);

    tracker.endSpan('non-existent-span-id');

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('unknown span: non-existent-span-id')
    );
  });

  it('should log in debug mode', () => {
    const mockLogger = {
      debug: jest.fn(),
      child: jest.fn().mockReturnThis(),
    };

    const tracker = new PerformanceTrackerAdapter(mockLogger as any, true);

    const spanId = tracker.startSpan('test', { context: 'value' });
    tracker.endSpan(spanId, { result: 42 });

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('[PERF] Started: test'),
      expect.any(Object)
    );

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('[PERF] Completed: test'),
      expect.any(Object)
    );
  });
});
