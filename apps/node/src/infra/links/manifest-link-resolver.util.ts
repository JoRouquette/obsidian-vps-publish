import path from 'node:path';

import type { ManifestPage } from '@core-domain';

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeComparablePath(value: string): string {
  return safeDecodeURIComponent(value)
    .replace(/\.md(?=#|$)/i, '')
    .replace(/\\/g, '/')
    .replace(/(^|\/)\.\//g, '$1')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .trim()
    .toLowerCase();
}

function splitLinkTarget(rawValue: string): { basePath: string; fragment?: string } {
  const hashIndex = rawValue.indexOf('#');
  return {
    basePath: hashIndex >= 0 ? rawValue.slice(0, hashIndex) : rawValue,
    fragment: hashIndex >= 0 ? rawValue.slice(hashIndex + 1) || undefined : undefined,
  };
}

function normalizeCurrentRoutePath(currentRoutePath: string): string {
  const normalized = safeDecodeURIComponent(currentRoutePath)
    .replace(/\\/g, '/')
    .replace(/\.html$/i, '')
    .replace(/^\/+|\/+$/g, '')
    .trim();

  return normalized ? `/${normalized}` : '/';
}

function resolveRelativeLinkTarget(
  rawValue: string,
  currentRoutePath?: string
): { basePath: string; fragment?: string } {
  const split = splitLinkTarget(rawValue);

  if (!currentRoutePath || !/^(?:\.\.\/|\.\/)/.test(split.basePath)) {
    return split;
  }

  const currentDirectory = path.posix.dirname(normalizeCurrentRoutePath(currentRoutePath));
  const resolvedBasePath = path.posix.normalize(path.posix.join(currentDirectory, split.basePath));

  return {
    basePath: resolvedBasePath,
    fragment: split.fragment,
  };
}

function getPageComparableKeys(page: ManifestPage): string[] {
  const keys = new Set<string>();

  const route = normalizeComparablePath(page.route);
  if (route) {
    keys.add(route);
  }

  if (page.relativePath) {
    keys.add(normalizeComparablePath(page.relativePath));
  }

  if (page.vaultPath) {
    keys.add(normalizeComparablePath(page.vaultPath));
  }

  if (page.slug?.value) {
    keys.add(normalizeComparablePath(page.slug.value));
  }

  return Array.from(keys.values());
}

function collectUniqueMatches(
  pages: ManifestPage[],
  predicate: (page: ManifestPage, keys: string[]) => boolean
): ManifestPage[] {
  const matches = pages.filter((page) => predicate(page, getPageComparableKeys(page)));
  return Array.from(new Map(matches.map((page) => [page.id, page])).values());
}

export interface ResolvedManifestLinkCandidate {
  page?: ManifestPage;
  fragment?: string;
  normalizedBasePath: string;
  ambiguousCandidates?: ManifestPage[];
}

export function normalizeManifestWikilinkTarget(target: string): string {
  return safeDecodeURIComponent(target)
    .replace(/\.md(?=#|$)/i, '')
    .replace(/^\/+/, '');
}

export function resolveManifestLinkCandidate(
  rawValue: string,
  pages: ManifestPage[],
  currentRoutePath?: string
): ResolvedManifestLinkCandidate {
  const split = resolveRelativeLinkTarget(rawValue, currentRoutePath);
  const normalizedBasePath = normalizeComparablePath(split.basePath || rawValue);

  if (!normalizedBasePath) {
    return {
      fragment: split.fragment,
      normalizedBasePath,
    };
  }

  const exactMatches = collectUniqueMatches(pages, (_page, keys) =>
    keys.includes(normalizedBasePath)
  );
  if (exactMatches.length === 1) {
    return {
      page: exactMatches[0],
      fragment: split.fragment,
      normalizedBasePath,
    };
  }
  if (exactMatches.length > 1) {
    return {
      fragment: split.fragment,
      normalizedBasePath,
      ambiguousCandidates: exactMatches,
    };
  }

  if (normalizedBasePath.includes('/')) {
    const tailMatches = collectUniqueMatches(pages, (_page, keys) =>
      keys.some((key) => key.endsWith(`/${normalizedBasePath}`))
    );

    if (tailMatches.length === 1) {
      return {
        page: tailMatches[0],
        fragment: split.fragment,
        normalizedBasePath,
      };
    }
    if (tailMatches.length > 1) {
      return {
        fragment: split.fragment,
        normalizedBasePath,
        ambiguousCandidates: tailMatches,
      };
    }
  }

  const basename = normalizedBasePath.split('/').pop() ?? normalizedBasePath;
  const basenameMatches = collectUniqueMatches(pages, (_page, keys) =>
    keys.some((key) => key === basename || key.endsWith(`/${basename}`))
  );

  if (basenameMatches.length === 1) {
    return {
      page: basenameMatches[0],
      fragment: split.fragment,
      normalizedBasePath,
    };
  }
  if (basenameMatches.length > 1) {
    return {
      fragment: split.fragment,
      normalizedBasePath,
      ambiguousCandidates: basenameMatches,
    };
  }

  return {
    fragment: split.fragment,
    normalizedBasePath,
  };
}
