export type BatcherSizeFn<T> = (item: T) => number;

const encoder = new TextEncoder();

export function jsonSizeBytes(payload: unknown): number {
  const json = JSON.stringify(payload);
  return encoder.encode(json).byteLength;
}

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
