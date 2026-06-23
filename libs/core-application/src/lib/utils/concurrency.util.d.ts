/**
 * Scheduler for yielding control to the event loop
 * Prevents UI freezing during long-running operations
 */
export declare class YieldScheduler {
    private readonly yieldEveryN;
    private readonly yieldEveryMs;
    private operationCount;
    private lastYieldTime;
    constructor(yieldEveryN?: number, yieldEveryMs?: number);
    /**
     * Check if we should yield, and if so, yield control to event loop
     * Call this in tight loops to keep UI responsive
     *
     * @returns Promise that resolves after yielding (or immediately if no yield needed)
     */
    maybeYield(): Promise<void>;
    /**
     * Unconditionally yield control to event loop
     */
    forceYield(): Promise<void>;
    /**
     * Reset internal counters (useful when starting a new phase)
     */
    reset(): void;
    /**
     * Get current stats (for debugging)
     */
    getStats(): {
        operationCount: number;
        msSinceLastYield: number;
    };
}
/**
 * Controlled concurrency limiter (similar to p-limit)
 * Limits number of concurrent async operations
 */
export declare class ConcurrencyLimiter {
    private readonly limit;
    private activeCount;
    private readonly queue;
    constructor(limit: number);
    /**
     * Run an async function with concurrency control
     * @param fn - Async function to execute
     * @returns Promise resolving to function result
     */
    run<T>(fn: () => Promise<T>): Promise<T>;
    private acquireSlot;
    private releaseSlot;
    /**
     * Get current stats
     */
    getStats(): {
        active: number;
        queued: number;
        limit: number;
    };
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
export declare function processWithControlledConcurrency<T, R>(items: T[], processFn: (item: T, index: number) => Promise<R>, options?: {
    concurrency?: number;
    yieldEveryN?: number;
    yieldEveryMs?: number;
    onProgress?: (completed: number, total: number) => void;
}): Promise<R[]>;
//# sourceMappingURL=concurrency.util.d.ts.map