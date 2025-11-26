import path from 'node:path';

import { resolveWithinRoot } from '../infra/utils/path-utils.util';

describe('resolveWithinRoot', () => {
  it('returns a path within the given root', () => {
    const root = path.resolve('/tmp/root');
    const target = resolveWithinRoot(root, 'nested', 'file.txt');

    expect(target).toBe(path.join(root, 'nested', 'file.txt'));
  });

  it('throws on path traversal outside root', () => {
    const root = path.resolve('/tmp/root');
    expect(() => resolveWithinRoot(root, '..', 'evil.txt')).toThrow(/Path traversal/);
  });
});
