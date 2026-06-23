"use strict";
/**
 * Scheduler for yielding control to the event loop
 * Prevents UI freezing during long-running operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConcurrencyLimiter = exports.YieldScheduler = void 0;
exports.processWithControlledConcurrency = processWithControlledConcurrency;
class YieldScheduler {
    constructor(yieldEveryN = 50, yieldEveryMs = 50) {
        this.yieldEveryN = yieldEveryN;
        this.yieldEveryMs = yieldEveryMs;
        this.operationCount = 0;
        this.lastYieldTime = performance.now();
    }
    /**
     * Check if we should yield, and if so, yield control to event loop
     * Call this in tight loops to keep UI responsive
     *
     * @returns Promise that resolves after yielding (or immediately if no yield needed)
     */
    async maybeYield() {
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
    async forceYield() {
        await new Promise((resolve) => setTimeout(resolve, 0));
        this.operationCount = 0;
        this.lastYieldTime = performance.now();
    }
    /**
     * Reset internal counters (useful when starting a new phase)
     */
    reset() {
        this.operationCount = 0;
        this.lastYieldTime = performance.now();
    }
    /**
     * Get current stats (for debugging)
     */
    getStats() {
        return {
            operationCount: this.operationCount,
            msSinceLastYield: performance.now() - this.lastYieldTime,
        };
    }
}
exports.YieldScheduler = YieldScheduler;
/**
 * Controlled concurrency limiter (similar to p-limit)
 * Limits number of concurrent async operations
 */
class ConcurrencyLimiter {
    constructor(limit) {
        this.limit = limit;
        this.activeCount = 0;
        this.queue = [];
        if (limit < 1) {
            throw new Error('Concurrency limit must be >= 1');
        }
    }
    /**
     * Run an async function with concurrency control
     * @param fn - Async function to execute
     * @returns Promise resolving to function result
     */
    async run(fn) {
        // Wait for a slot to become available
        await this.acquireSlot();
        try {
            return await fn();
        }
        finally {
            this.releaseSlot();
        }
    }
    async acquireSlot() {
        if (this.activeCount < this.limit) {
            this.activeCount++;
            return;
        }
        // Wait for a slot to free up
        return new Promise((resolve) => {
            this.queue.push(resolve);
        });
    }
    releaseSlot() {
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
    getStats() {
        return {
            active: this.activeCount,
            queued: this.queue.length,
            limit: this.limit,
        };
    }
}
exports.ConcurrencyLimiter = ConcurrencyLimiter;
/**
 * Process items with controlled concurrency and periodic yields
 * More sophisticated than processWithConcurrencyControl - adds yield scheduler
 *
 * @param items - Array of items to process
 * @param processFn - Async function to process each item
 * @param options - Configuration options
 * @returns Array of results in same order as input
 */
async function processWithControlledConcurrency(items, processFn, options = {}) {
    const { concurrency = 5, yieldEveryN = 50, yieldEveryMs = 50, onProgress } = options;
    if (items.length === 0) {
        return [];
    }
    const limiter = new ConcurrencyLimiter(concurrency);
    const yieldScheduler = new YieldScheduler(yieldEveryN, yieldEveryMs);
    const results = new Array(items.length);
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
