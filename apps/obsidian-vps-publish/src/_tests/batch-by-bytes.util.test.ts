import { batchByBytes, jsonSizeBytes } from '../lib/utils/batch-by-bytes.util';

const wrap = (batch: unknown[]) => ({ data: batch });

describe('batchByBytes', () => {
  it('regroupe les éléments tant que la limite n’est pas dépassée', () => {
    const items = ['a', 'b', 'c', 'd'];
    const sizeForTwo = jsonSizeBytes(wrap(items.slice(0, 2)));
    const maxBytes = sizeForTwo + 1; // autorise 2, pas 3

    const batches = batchByBytes(items, maxBytes, wrap);

    expect(batches).toHaveLength(2);
    expect(batches[0]).toEqual(['a', 'b']);
    expect(batches[1]).toEqual(['c', 'd']);
  });

  it('ne split pas quand tout tient dans la limite', () => {
    const items = ['note-1', 'note-2'];
    const maxBytes = jsonSizeBytes(wrap(items)) + 10;

    const batches = batchByBytes(items, maxBytes, wrap);

    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual(items);
  });

  it('lève une erreur si maxBytes est invalide', () => {
    expect(() => batchByBytes(['x'], 0, wrap)).toThrow('maxBytes must be > 0');
  });

  it('lève une erreur si un élément seul dépasse la limite', () => {
    const huge = 'x'.repeat(1024);
    const maxBytes = 10;

    expect(() => batchByBytes([huge], maxBytes, wrap)).toThrow(
      'Single item exceeds maxBytes limit'
    );
  });
});
