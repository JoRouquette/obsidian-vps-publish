/**
 * Scheduler for yielding control to the event loop
 * Prevents UI freezing during long-running operations
 */

export class YieldScheduler {
  private operationCount = 0;
  private lastYieldTime = performance.now();

  constructor(
    private readonly yieldEveryN: number = 50,
    private readonly yieldEveryMs: number = 50
  ) {}

  /**
   * Check if we should yield, and if so, yield control to event loop
   * Call this in tight loops to keep UI responsive
   *
   * @returns Promise that resolves after yielding (or immediately if no yield needed)
   */
  async maybeYield(): Promise<void> {
    this.operationCount++;
    const now = performance.now();
    const elapsed = now - this.lastYieldTime;

    const shouldYieldByCount = this.operationCount >= this.yieldEveryN;
    const shouldYieldByTime = elapsed >= this.yieldEveryMs;

    if (shouldYieldByCount || shouldYieldByTime) {
      await this.forceYield();
    }
  }

  /**
   * Unconditionally yield control to event loop
   */
  async forceYield(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    this.operationCount = 0;
    this.lastYieldTime = performance.now();
  }

  /**
   * Reset internal counters (useful when starting a new phase)
   */
  reset(): void {
    this.operationCount = 0;
    this.lastYieldTime = performance.now();
  }

  /**
   * Get current stats (for debugging)
   */
  getStats(): { operationCount: number; msSinceLastYield: number } {
    return {
      operationCount: this.operationCount,
      msSinceLastYield: performance.now() - this.lastYieldTime,
    };
  }
}

/**
 * Controlled concurrency limiter (similar to p-limit)
 * Limits number of concurrent async operations
 */
export class ConcurrencyLimiter {
  private activeCount = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly limit: number) {
    if (limit < 1) {
      throw new Error('Concurrency limit must be >= 1');
    }
  }

  /**
   * Run an async function with concurrency control
   * @param fn - Async function to execute
   * @returns Promise resolving to function result
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    // Wait for a slot to become available
    await this.acquireSlot();

    try {
      return await fn();
    } finally {
      this.releaseSlot();
    }
  }

  private async acquireSlot(): Promise<void> {
    if (this.activeCount < this.limit) {
      this.activeCount++;
      return;
    }

    // Wait for a slot to free up
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  private releaseSlot(): void {
    this.activeCount--;

    // Release next queued task
    const next = this.queue.shift();
    if (next) {
      this.activeCount++;
      next();
    }
  }

  /**
   * Get current stats
   */
  getStats(): { active: number; queued: number; limit: number } {
    return {
      active: this.activeCount,
      queued: this.queue.length,
      limit: this.limit,
    };
  }
}

/**
 * Process items with controlled concurrency and periodic yields
 * More sophisticated than processWithConcurrencyControl - adds yield scheduler
 *
 * @param items - Array of items to process
 * @param processFn - Async function to process each item
 * @param options - Configuration options
 * @returns Array of results in same order as input
 */
export async function processWithControlledConcurrency<T, R>(
  items: T[],
  processFn: (item: T, index: number) => Promise<R>,
  options: {
    concurrency?: number;
    yieldEveryN?: number;
    yieldEveryMs?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<R[]> {
  const { concurrency = 5, yieldEveryN = 50, yieldEveryMs = 50, onProgress } = options;

  if (items.length === 0) {
    return [];
  }

  const limiter = new ConcurrencyLimiter(concurrency);
  const yieldScheduler = new YieldScheduler(yieldEveryN, yieldEveryMs);
  const results: R[] = new Array(items.length);

  let completed = 0;

  // Create all tasks upfront
  const tasks = items.map(async (item, index) => {
    const result = await limiter.run(async () => {
      const r = await processFn(item, index);

      completed++;
      if (onProgress) {
        onProgress(completed, items.length);
      }

      // Yield periodically
      await yieldScheduler.maybeYield();

      return r;
    });

    results[index] = result;
  });

  await Promise.all(tasks);

  return results;
}
