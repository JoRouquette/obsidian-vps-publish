import path from 'node:path';

export function resolveWithinRoot(root: string, ...segments: string[]): string {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, ...segments);

  if (!target.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`Path traversal detected: ${target} is outside root ${resolvedRoot}`);
  }

  return target;
}
