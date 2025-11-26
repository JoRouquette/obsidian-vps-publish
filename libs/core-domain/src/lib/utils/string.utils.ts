/**
 * Normalize a string to be a valid object property:
 * - Lowercase
 * - Remove dashes, underscores, accents, and non-identifier characters
 * - Idempotent: applying multiple times yields the same result
 */
export function normalizePropertyKey(key: string): string {
  // Remove accents
  const noAccents = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Remove dashes, underscores, and non-identifier characters, lowercase
  return noAccents.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

export function toString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value)) {
    const segments = value.map((item) => toString(item));
    segments.sort();
    return segments.join(', ');
  }

  if (typeof value === 'object') {
    const entries: string[] = [];
    for (const key of Object.keys(value).sort()) {
      const propValue = (value as Record<string, unknown>)[key];
      if (typeof propValue === 'function') {
        entries.push(`(func)${key}`);
      } else {
        entries.push(`(prop)${key}: ${toString(propValue)}`);
      }
    }
    return entries.join(', ');
  }

  if (typeof value === 'function') {
    return '(func)';
  }

  return String(value);
}
