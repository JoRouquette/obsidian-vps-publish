/**
 * Normalize a string to camelCase suitable for object properties.
 * - Split on dashes, underscores, and spaces
 * - Lowercase all segments, then capitalize the first letter of subsequent ones
 * - Leave keys that are already camelCase untouched
 */
export function normalizePropertyKey(key: string): string {
  const noAccents = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const trimmed = noAccents.trim();

  const hasSeparators = /[-_\s]/.test(trimmed);
  const isCamelCase = !hasSeparators && /^[a-z][A-Za-z0-9]*$/.test(trimmed);
  if (isCamelCase) {
    return trimmed;
  }

  const segments = trimmed
    .split(/[-_\s]+/)
    .map((segment) => segment.replace(/[^A-Za-z0-9]/g, ''))
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());

  if (segments.length === 0) {
    return '';
  }

  const [first, ...rest] = segments;
  const camelized = first + rest.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');
  return camelized;
}

/**
 * Convert a normalized property key to a human readable label.
 * Example: "effetSecondaire" -> "Effet secondaire"
 */
export function humanizePropertyKey(key: string): string {
  const noAccents = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const spaced = noAccents
    .replace(/[-_\s]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();

  if (!spaced) return '';

  return spaced
    .split(/\s+/)
    .filter(Boolean)
    .map((segment, index) => {
      const lower = segment.toLowerCase();
      if (index === 0) {
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      }
      return lower;
    })
    .join(' ');
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
