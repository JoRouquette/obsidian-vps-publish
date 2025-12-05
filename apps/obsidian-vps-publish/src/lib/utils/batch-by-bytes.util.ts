export type BatcherSizeFn<T> = (item: T) => number;

const encoder = new TextEncoder();

export function jsonSizeBytes(payload: unknown): number {
  const json = JSON.stringify(payload);
  return encoder.encode(json).byteLength;
}

export type BatchResult<T> = {
  batches: T[][];
  oversized: T[];
};

export function batchByBytes<T>(
  items: T[],
  maxBytes: number,
  wrapBody: (batch: T[]) => unknown
): BatchResult<T> {
  if (maxBytes <= 0) {
    throw new Error('maxBytes must be > 0');
  }

  const batches: T[][] = [];
  const oversized: T[] = [];
  let current: T[] = [];

  for (const item of items) {
    const tentative = [...current, item];
    const size = jsonSizeBytes(wrapBody(tentative));

    if (size <= maxBytes) {
      current = tentative;
      continue;
    }

    if (current.length === 0) {
      // Single item exceeds limit - mark as oversized and continue
      oversized.push(item);
      continue;
    }

    batches.push(current);
    current = [item];
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return { batches, oversized };
}
