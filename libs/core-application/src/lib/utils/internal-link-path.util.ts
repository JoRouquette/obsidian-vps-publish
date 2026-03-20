function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function stripMarkdownExtensionPreservingFragment(value: string): string {
  const hashIndex = value.indexOf('#');
  const basePath = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
  const fragment = hashIndex >= 0 ? value.slice(hashIndex) : '';
  return `${basePath.replace(/\.md$/i, '')}${fragment}`;
}

export function splitInternalLinkTarget(value: string): { path: string; fragment?: string } {
  const hashIndex = value.indexOf('#');
  if (hashIndex === -1) {
    return { path: value.trim() };
  }

  const path = value.slice(0, hashIndex).trim();
  const fragment = value.slice(hashIndex + 1).trim();
  return {
    path,
    fragment: fragment || undefined,
  };
}

export function normalizeInternalLinkPath(value: string): string {
  return safeDecodeURIComponent(value)
    .replace(/\\/g, '/')
    .replace(/(^|\/)\.\//g, '$1')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .trim();
}

export function normalizeInternalLinkKey(value: string): string {
  const normalized = normalizeInternalLinkPath(value);
  if (!normalized) {
    return '';
  }

  return normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function getInternalLinkBasename(value: string): string {
  const normalized = normalizeInternalLinkPath(value);
  if (!normalized) {
    return '';
  }

  const segments = normalized.split('/');
  return segments[segments.length - 1] ?? normalized;
}

function getInternalLinkDirname(value: string): string {
  const normalized = normalizeInternalLinkPath(value);
  if (!normalized) {
    return '';
  }

  const segments = normalized.split('/');
  segments.pop();
  return segments.join('/');
}

function resolvePosixLikePath(baseDirectory: string, relativePath: string): string {
  const combinedSegments = [...baseDirectory.split('/'), ...relativePath.split('/')];
  const resolvedSegments: string[] = [];

  for (const segment of combinedSegments) {
    if (!segment || segment === '.') {
      continue;
    }

    if (segment === '..') {
      resolvedSegments.pop();
      continue;
    }

    resolvedSegments.push(segment);
  }

  return resolvedSegments.join('/');
}

export function resolveRelativeInternalLinkPath(
  value: string,
  currentNoteRelativePath?: string
): string {
  const normalizedValue = normalizeInternalLinkPath(value);
  if (!normalizedValue || !/^(?:\.\.\/|\.\/)/.test(normalizedValue) || !currentNoteRelativePath) {
    return normalizedValue;
  }

  const currentDirectory = getInternalLinkDirname(currentNoteRelativePath);
  return resolvePosixLikePath(currentDirectory, normalizedValue);
}
