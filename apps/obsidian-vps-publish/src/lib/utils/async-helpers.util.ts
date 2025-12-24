/**
 * Async utility helpers for performance optimization
 * These utilities help prevent blocking the event loop during long-running operations
 */

/**
 * Yield control back to the event loop.
 * Call this periodically in long-running synchronous loops to keep UI responsive.
 */
export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Process items in batches with controlled concurrency, yielding to event loop between batches.
 * This prevents blocking the UI during heavy processing.
 *
 * @param items - Array of items to process
 * @param processItem - Async function to process each item
 * @param options - Configuration options
 * @returns Array of results in the same order as input items
 */
export async function processWithConcurrencyControl<T, R>(
  items: T[],
  processItem: (item: T, index: number) => Promise<R>,
  options: {
    concurrency?: number;
    batchSize?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<R[]> {
  const { concurrency = 5, batchSize = 10, onProgress } = options;
  const results: R[] = new Array(items.length);
  const queue: Array<{ item: T; index: number }> = items.map((item, index) => ({ item, index }));

  let completed = 0;
  let batchCount = 0;

  // Process items with controlled concurrency
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) break;

      try {
        results[task.index] = await processItem(task.item, task.index);
        completed++;

        if (onProgress) {
          onProgress(completed, items.length);
        }

        // Yield to event loop after processing batch
        batchCount++;
        if (batchCount % batchSize === 0) {
          await yieldToEventLoop();
        }
      } catch (error) {
        // Re-throw to be caught by Promise.all
        throw error;
      }
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Process items sequentially with periodic yields to event loop.
 * Use this when order matters or when concurrent processing is not desired.
 *
 * @param items - Array of items to process
 * @param processItem - Function to process each item (can be sync or async)
 * @param options - Configuration options
 * @returns Array of results in the same order as input items
 */
export async function processSequentiallyWithYields<T, R>(
  items: T[],
  processItem: (item: T, index: number) => R | Promise<R>,
  options: {
    yieldEvery?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<R[]> {
  const { yieldEvery = 10, onProgress } = options;
  const results: R[] = [];

  for (let i = 0; i < items.length; i++) {
    results.push(await processItem(items[i], i));

    if (onProgress) {
      onProgress(i + 1, items.length);
    }

    // Yield to event loop periodically
    if ((i + 1) % yieldEvery === 0) {
      await yieldToEventLoop();
    }
  }

  return results;
}
