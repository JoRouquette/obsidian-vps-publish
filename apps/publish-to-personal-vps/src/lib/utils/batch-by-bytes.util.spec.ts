import { batchByBytes, jsonSizeBytes } from './batch-by-bytes.util';

describe('batchByBytes', () => {
  it('batches items without exceeding limit', () => {
    const items = ['a', 'b', 'c'];
    const batches = batchByBytes(items, 15, (batch) => ({ notes: batch }));
    expect(batches.length).toBeGreaterThan(0);
    expect(batches.flat()).toEqual(items);
  });

  it('throws when a single item exceeds the limit', () => {
    const items = ['long-string-exceeding-limit'];
    expect(() =>
      batchByBytes(items, 5, (batch) => ({ notes: batch }))
    ).toThrow();
  });

  it('computes json size in bytes', () => {
    const size = jsonSizeBytes({ text: 'é' });
    expect(size).toBeGreaterThan(0);
  });
});
