/**
 * Scheduler for yielding control to the event loop
 * Prevents UI freezing during long-running operations
 *
 * Copied from @core-application to avoid lazy-load boundary violation
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
}
