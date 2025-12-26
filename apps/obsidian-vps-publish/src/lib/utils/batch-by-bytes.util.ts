export type BatcherSizeFn<T> = (item: T) => number;

const encoder = new TextEncoder();

/**
 * Yield to event loop helper
 */
async function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function jsonSizeBytes(payload: unknown): number {
  const json = JSON.stringify(payload);
  return encoder.encode(json).byteLength;
}

/**
 * Batch items by total JSON byte size (synchronous version).
 * For large datasets (>100 items), prefer batchByBytesAsync to avoid blocking.
 */
export function batchByBytes<T>(
  items: T[],
  maxBytes: number,
  wrapBody: (batch: T[]) => unknown
): T[][] {
  if (maxBytes <= 0) {
    throw new Error('maxBytes must be > 0');
  }

  const batches: T[][] = [];
  let current: T[] = [];

  for (const item of items) {
    const tentative = [...current, item];
    const size = jsonSizeBytes(wrapBody(tentative));

    if (size <= maxBytes) {
      // Item fits in current batch
      current = tentative;
      continue;
    }

    if (current.length === 0) {
      // Single item exceeds limit - put it in its own batch (will be chunked)
      batches.push([item]);
      continue;
    }

    // Current batch is full, start new batch with this item
    batches.push(current);
    current = [item];
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
}

/**
 * Batch items by total JSON byte size (async version with yields).
 * Yields to event loop every N items to prevent UI blocking on large datasets.
 * Recommended for datasets with >100 items.
 */
export async function batchByBytesAsync<T>(
  items: T[],
  maxBytes: number,
  wrapBody: (batch: T[]) => unknown,
  yieldEvery = 50
): Promise<T[][]> {
  if (maxBytes <= 0) {
    throw new Error('maxBytes must be > 0');
  }

  const batches: T[][] = [];
  let current: T[] = [];
  let processedCount = 0;

  for (const item of items) {
    const tentative = [...current, item];
    const size = jsonSizeBytes(wrapBody(tentative));

    if (size <= maxBytes) {
      // Item fits in current batch
      current = tentative;
    } else {
      if (current.length === 0) {
        // Single item exceeds limit - put it in its own batch (will be chunked)
        batches.push([item]);
      } else {
        // Current batch is full, start new batch with this item
        batches.push(current);
        current = [item];
      }
    }

    // Yield periodically to keep UI responsive
    processedCount++;
    if (processedCount % yieldEvery === 0) {
      await yieldToEventLoop();
    }
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
}
