import { batchByBytes, jsonSizeBytes } from '../lib/utils/batch-by-bytes.util';

const wrap = (batch: unknown[]) => ({ data: batch });

describe('batchByBytes', () => {
  it('regroupe les éléments tant que la limite n’est pas dépassée', () => {
    const items = ['a', 'b', 'c', 'd'];
    const sizeForTwo = jsonSizeBytes(wrap(items.slice(0, 2)));
    const maxBytes = sizeForTwo + 1; // autorise 2, pas 3

    const result = batchByBytes(items, maxBytes, wrap);

    expect(result.batches).toHaveLength(2);
    expect(result.batches[0]).toEqual(['a', 'b']);
    expect(result.batches[1]).toEqual(['c', 'd']);
    expect(result.oversized).toEqual([]);
  });

  it('ne split pas quand tout tient dans la limite', () => {
    const items = ['note-1', 'note-2'];
    const maxBytes = jsonSizeBytes(wrap(items)) + 10;

    const result = batchByBytes(items, maxBytes, wrap);

    expect(result.batches).toHaveLength(1);
    expect(result.batches[0]).toEqual(items);
    expect(result.oversized).toEqual([]);
  });

  it('lève une erreur si maxBytes est invalide', () => {
    expect(() => batchByBytes(['x'], 0, wrap)).toThrow('maxBytes must be > 0');
  });

  it('met les éléments trop volumineux dans oversized au lieu de throw', () => {
    const huge = 'x'.repeat(1024);
    const small = 'y';
    const maxBytes = 50; // Enough for small items

    const result = batchByBytes([small, huge, small], maxBytes, wrap);

    expect(result.batches.length).toBeGreaterThan(0);
    expect(result.oversized).toContain(huge);
    expect(result.oversized.length).toBe(1);
  });
});
