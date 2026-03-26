export type BatcherSizeFn<T> = (item: T) => number;

const encoder = new TextEncoder();

type PreparedBatchSizing<T> = {
  emptyBatchSize: number;
  itemSizes: number[];
  items: T[];
  maxBytes: number;
};

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
  return buildBatches(prepareBatchSizing(items, maxBytes, wrapBody));
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
  return buildBatchesAsync(prepareBatchSizing(items, maxBytes, wrapBody), yieldEvery);
}

function prepareBatchSizing<T>(
  items: T[],
  maxBytes: number,
  wrapBody: (batch: T[]) => unknown
): PreparedBatchSizing<T> {
  if (maxBytes <= 0) {
    throw new Error('maxBytes must be > 0');
  }

  const emptyBatchSize = jsonSizeBytes(wrapBody([]));
  const itemSizes = items.map((item) =>
    Math.max(0, jsonSizeBytes(wrapBody([item])) - emptyBatchSize)
  );

  return {
    emptyBatchSize,
    itemSizes,
    items,
    maxBytes,
  };
}

function buildBatches<T>(prepared: PreparedBatchSizing<T>): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let currentSize = prepared.emptyBatchSize;

  for (let index = 0; index < prepared.items.length; index++) {
    const item = prepared.items[index];
    const itemSize = prepared.itemSizes[index];
    const additionalSize = current.length === 0 ? itemSize : itemSize + 1;

    if (currentSize + additionalSize <= prepared.maxBytes) {
      current.push(item);
      currentSize += additionalSize;
      continue;
    }

    if (current.length === 0) {
      batches.push([item]);
      currentSize = prepared.emptyBatchSize;
      continue;
    }

    batches.push(current);
    current = [item];
    currentSize = prepared.emptyBatchSize + itemSize;
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
}

async function buildBatchesAsync<T>(
  prepared: PreparedBatchSizing<T>,
  yieldEvery: number
): Promise<T[][]> {
  const batches: T[][] = [];
  let current: T[] = [];
  let currentSize = prepared.emptyBatchSize;

  for (let index = 0; index < prepared.items.length; index++) {
    const item = prepared.items[index];
    const itemSize = prepared.itemSizes[index];
    const additionalSize = current.length === 0 ? itemSize : itemSize + 1;

    if (currentSize + additionalSize <= prepared.maxBytes) {
      current.push(item);
      currentSize += additionalSize;
    } else if (current.length === 0) {
      batches.push([item]);
      currentSize = prepared.emptyBatchSize;
    } else {
      batches.push(current);
      current = [item];
      currentSize = prepared.emptyBatchSize + itemSize;
    }

    if ((index + 1) % yieldEvery === 0) {
      await yieldToEventLoop();
    }
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
}
