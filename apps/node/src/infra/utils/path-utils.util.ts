import path from 'node:path';

export function resolveWithinRoot(root: string, ...segments: string[]): string {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, ...segments);

  // Allow target to be exactly resolvedRoot (no segments case) or start with resolvedRoot + separator
  if (target !== resolvedRoot && !target.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`Path traversal detected: ${target} is outside root ${resolvedRoot}`);
  }

  return target;
}
