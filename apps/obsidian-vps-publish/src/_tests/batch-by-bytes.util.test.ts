import { batchByBytes, jsonSizeBytes } from '../lib/utils/batch-by-bytes.util';

const wrap = (batch: unknown[]) => ({ data: batch });

describe('batchByBytes', () => {
  it('groups items until limit is exceeded', () => {
    const items = ['a', 'b', 'c', 'd'];
    const sizeForTwo = jsonSizeBytes(wrap(items.slice(0, 2)));
    const maxBytes = sizeForTwo + 1; // allows 2, not 3

    const result = batchByBytes(items, maxBytes, wrap);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(['a', 'b']);
    expect(result[1]).toEqual(['c', 'd']);
  });

  it('does not split when everything fits', () => {
    const items = ['note-1', 'note-2'];
    const maxBytes = jsonSizeBytes(wrap(items)) + 10;

    const result = batchByBytes(items, maxBytes, wrap);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(items);
  });

  it('throws error if maxBytes is invalid', () => {
    expect(() => batchByBytes(['x'], 0, wrap)).toThrow('maxBytes must be > 0');
  });

  it('puts oversized item in its own batch (will be chunked)', () => {
    const huge = 'x'.repeat(1024);
    const small = 'y';
    const maxBytes = 50; // Enough for small items only

    const result = batchByBytes([small, huge, small], maxBytes, wrap);

    // Large item is in its own batch, will be handled by chunked upload
    expect(result.length).toBe(3);
    expect(result[0]).toEqual([small]);
    expect(result[1]).toEqual([huge]); // In its own batch
    expect(result[2]).toEqual([small]);
  });

  it('handles multiple consecutive oversized items', () => {
    const huge1 = 'x'.repeat(1024);
    const huge2 = 'y'.repeat(1024);
    const small = 'z';
    const maxBytes = 50;

    const result = batchByBytes([huge1, huge2, small], maxBytes, wrap);

    // Each large item in its own batch
    expect(result.length).toBe(3);
    expect(result[0]).toEqual([huge1]);
    expect(result[1]).toEqual([huge2]);
    expect(result[2]).toEqual([small]);
  });
});
