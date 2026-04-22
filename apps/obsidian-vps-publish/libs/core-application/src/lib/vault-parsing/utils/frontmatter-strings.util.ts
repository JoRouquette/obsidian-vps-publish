export interface FrontmatterStringEntry {
  path: string;
  value: string;
}

/**
 * Extract all string values from a nested frontmatter object and keep their property paths.
 */
export function extractFrontmatterStrings(
  source: unknown,
  currentPath = ''
): FrontmatterStringEntry[] {
  const results: FrontmatterStringEntry[] = [];

  const visit = (value: unknown, path: string) => {
    if (value === null || value === undefined) return;

    if (typeof value === 'string') {
      results.push({ path, value });
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const nextPath = path ? `${path}[${index}]` : `[${index}]`;
        visit(item, nextPath);
      });
      return;
    }

    if (typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
        const nextPath = path ? `${path}.${key}` : key;
        visit(val, nextPath);
      });
    }
  };

  visit(source, currentPath);
  return results;
}
