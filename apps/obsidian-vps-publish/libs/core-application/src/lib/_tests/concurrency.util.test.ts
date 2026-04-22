import {
  ConcurrencyLimiter,
  processWithControlledConcurrency,
  YieldScheduler,
} from '../utils/concurrency.util';

describe('YieldScheduler', () => {
  it('should yield after N operations', async () => {
    const scheduler = new YieldScheduler(5, 1000); // Yield every 5 operations

    const yieldCalls: number[] = [];

    for (let i = 0; i < 15; i++) {
      const statsBefore = scheduler.getStats();
      await scheduler.maybeYield();
      const statsAfter = scheduler.getStats();

      if (statsAfter.operationCount === 0 && statsBefore.operationCount > 0) {
        yieldCalls.push(i);
      }
    }

    // Should have yielded at 5, 10, 15
    expect(yieldCalls.length).toBeGreaterThan(0);
    expect(yieldCalls.length).toBeLessThanOrEqual(3);
  });

  it('should reset counters', () => {
    const scheduler = new YieldScheduler(10, 1000);

    for (let i = 0; i < 5; i++) {
      scheduler.maybeYield();
    }

    const statsBefore = scheduler.getStats();
    expect(statsBefore.operationCount).toBeGreaterThan(0);

    scheduler.reset();

    const statsAfter = scheduler.getStats();
    expect(statsAfter.operationCount).toBe(0);
  });

  it('should force yield immediately', async () => {
    const scheduler = new YieldScheduler(100, 1000); // High thresholds

    for (let i = 0; i < 3; i++) {
      await scheduler.maybeYield(); // Should not yield yet
    }

    const statsBefore = scheduler.getStats();
    expect(statsBefore.operationCount).toBe(3);

    await scheduler.forceYield();

    const statsAfter = scheduler.getStats();
    expect(statsAfter.operationCount).toBe(0);
  });
});

describe('ConcurrencyLimiter', () => {
  it('should limit concurrent operations', async () => {
    const limiter = new ConcurrencyLimiter(2);
    let activeCount = 0;
    let maxActiveCount = 0;

    const tasks = Array.from({ length: 10 }, (_, i) =>
      limiter.run(async () => {
        activeCount++;
        maxActiveCount = Math.max(maxActiveCount, activeCount);

        // Simulate async work
        await new Promise((resolve) => setTimeout(resolve, 10));

        activeCount--;
        return i;
      })
    );

    const results = await Promise.all(tasks);

    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(maxActiveCount).toBeLessThanOrEqual(2);
  });

  it('should handle errors without blocking queue', async () => {
    const limiter = new ConcurrencyLimiter(2);

    const tasks = [
      limiter.run(async () => 'success1'),
      limiter.run(async () => {
        throw new Error('Test error');
      }),
      limiter.run(async () => 'success2'),
    ];

    const results = await Promise.allSettled(tasks);

    expect(results[0]).toEqual({ status: 'fulfilled', value: 'success1' });
    expect(results[1].status).toBe('rejected');
    expect(results[2]).toEqual({ status: 'fulfilled', value: 'success2' });
  });

  it('should return stats correctly', async () => {
    const limiter = new ConcurrencyLimiter(2);

    const task1 = limiter.run(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return 'done';
    });

    // Give task1 time to start
    await new Promise((resolve) => setTimeout(resolve, 5));

    const stats = limiter.getStats();
    expect(stats.limit).toBe(2);
    expect(stats.active).toBeGreaterThan(0);

    await task1;
  });
});

describe('processWithControlledConcurrency', () => {
  it('should process items with controlled concurrency', async () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const processedOrder: number[] = [];

    const results = await processWithControlledConcurrency(
      items,
      async (item) => {
        processedOrder.push(item);
        await new Promise((resolve) => setTimeout(resolve, 5));
        return item * 2;
      },
      {
        concurrency: 3,
        yieldEveryN: 5,
      }
    );

    // Results should be in original order
    expect(results).toEqual(items.map((i) => i * 2));

    // All items should be processed
    expect(processedOrder.length).toBe(20);
  });

  it('should call progress callback', async () => {
    const items = [1, 2, 3, 4, 5];
    const progressUpdates: Array<{ completed: number; total: number }> = [];

    await processWithControlledConcurrency(items, async (item) => item * 2, {
      concurrency: 2,
      onProgress: (completed, total) => {
        progressUpdates.push({ completed, total });
      },
    });

    expect(progressUpdates.length).toBe(5);
    expect(progressUpdates[progressUpdates.length - 1]).toEqual({ completed: 5, total: 5 });
  });

  it('should handle empty array', async () => {
    const results = await processWithControlledConcurrency([], async (item) => item, {
      concurrency: 2,
    });

    expect(results).toEqual([]);
  });

  it('should propagate errors', async () => {
    const items = [1, 2, 3];

    await expect(
      processWithControlledConcurrency(
        items,
        async (item) => {
          if (item === 2) {
            throw new Error('Test error');
          }
          return item;
        },
        { concurrency: 1 }
      )
    ).rejects.toThrow('Test error');
  });
});
