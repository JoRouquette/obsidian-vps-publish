import { normalizePropertyKey } from './string.utils';

type PlainRecord = Record<string, unknown>;

function isPlainRecord(value: unknown): value is PlainRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Builds the set of normalized key names to exclude (matched at any depth).
 */
export function buildExcludedKeySet(rawKeys: readonly string[] | undefined): Set<string> {
  return new Set((rawKeys ?? []).map((k) => normalizePropertyKey(k)).filter(Boolean));
}

/**
 * Removes, in place and at any depth, every key whose normalized name is in `keysToRemove`.
 * Objects left empty by the removal are dropped too.
 */
export function removeNestedKeys(
  target: PlainRecord,
  keysToRemove: ReadonlySet<string>,
  onRemove?: (key: string) => void
): void {
  for (const key of Object.keys(target)) {
    const value = target[key];

    if (keysToRemove.has(normalizePropertyKey(key))) {
      onRemove?.(key);
      delete target[key];
      continue;
    }

    if (isPlainRecord(value)) {
      removeNestedKeys(value, keysToRemove, onRemove);
      if (Object.keys(value).length === 0) {
        delete target[key];
      }
    } else if (Array.isArray(value)) {
      removeKeysInArray(value, keysToRemove, onRemove);
    }
  }
}

/** Objects held by an array are cleaned in place; the array keeps its length and order. */
function removeKeysInArray(
  items: unknown[],
  keysToRemove: ReadonlySet<string>,
  onRemove?: (key: string) => void
): void {
  for (const item of items) {
    if (isPlainRecord(item)) {
      removeNestedKeys(item, keysToRemove, onRemove);
    } else if (Array.isArray(item)) {
      removeKeysInArray(item, keysToRemove, onRemove);
    }
  }
}

/**
 * Removes, in place, the value addressed by a dotted path (e.g. `meta.secret`).
 * Each segment is compared on its normalized form; emptied parents are dropped.
 */
export function deleteNestedPath(target: PlainRecord, rawPath: string): void {
  const segments = rawPath
    .split('.')
    .map((s) => normalizePropertyKey(s))
    .filter(Boolean);
  if (segments.length === 0) return;
  deletePathRecursive(target, segments);
}

function deletePathRecursive(target: PlainRecord, segments: string[]): void {
  const [head, ...rest] = segments;

  for (const key of Object.keys(target)) {
    if (normalizePropertyKey(key) !== head) continue;

    if (rest.length === 0) {
      delete target[key];
      return;
    }

    const next = target[key];
    if (isPlainRecord(next)) {
      deletePathRecursive(next, rest);
      if (Object.keys(next).length === 0) {
        delete target[key];
      }
    } else if (Array.isArray(next)) {
      deletePathInArray(next, rest);
    }
  }
}

/** The remaining path is applied to each object held by the array; the array itself stays. */
function deletePathInArray(items: unknown[], segments: string[]): void {
  for (const item of items) {
    if (isPlainRecord(item)) {
      deletePathRecursive(item, segments);
    } else if (Array.isArray(item)) {
      deletePathInArray(item, segments);
    }
  }
}

/** Copies plain objects and arrays; any other value (Date, primitive) is kept by reference. */
function clonePlain(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => clonePlain(v));
  if (isPlainRecord(value)) {
    const copy: PlainRecord = {};
    for (const [k, v] of Object.entries(value)) {
      copy[k] = clonePlain(v);
    }
    return copy;
  }
  return value;
}

/**
 * Returns a deep copy of `nested` without the excluded keys; `nested` is left untouched.
 * With no key to exclude the original object is returned as is (no copy).
 */
export function omitExcludedFrontmatterKeys(
  nested: PlainRecord,
  rawKeys: readonly string[] | undefined
): PlainRecord {
  const keysToRemove = buildExcludedKeySet(rawKeys);
  if (keysToRemove.size === 0) return nested;

  const copy = clonePlain(nested) as PlainRecord;
  removeNestedKeys(copy, keysToRemove);
  for (const rawKey of rawKeys ?? []) {
    deleteNestedPath(copy, rawKey);
  }
  return copy;
}
