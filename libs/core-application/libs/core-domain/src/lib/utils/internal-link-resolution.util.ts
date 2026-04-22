import type { ManifestPage } from '../entities/manifest-page';

export type InternalLinkFragmentType = 'heading' | 'block' | 'unknown' | null;
export type InternalLinkMatchSource =
  | 'route'
  | 'relativePath'
  | 'vaultPath'
  | 'slug'
  | 'title'
  | 'alias'
  | 'tail'
  | 'basename';

export interface CanonicalInternalLinkResolution {
  raw: string;
  normalizedBasePath: string;
  query: string;
  fragmentRaw: string | null;
  fragmentCanonical: string | null;
  fragmentType: InternalLinkFragmentType;
  page?: ManifestPage;
  resolvedRoute: string | null;
  resolvedHref: string | null;
  aliasMatched: boolean;
  resolved: boolean;
  matchSource: InternalLinkMatchSource | null;
  unresolvedReason: 'empty' | 'not-found' | 'ambiguous' | null;
  ambiguousCandidates?: ManifestPage[];
}

export interface ParsedInternalHref {
  raw: string;
  path: string;
  search: string;
  fragment: string | null;
  normalizedHref: string;
  isFragmentOnly: boolean;
}

const INTERNAL_URL_BASE = 'https://internal.local';

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function safeDecodeURI(value: string): string {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}

function stripMarkdownExtension(value: string): string {
  return value.replace(/\.md$/i, '');
}

function normalizePath(value: string): string {
  return safeDecodeURIComponent(value)
    .replace(/\\/g, '/')
    .replace(/(^|\/)\.\//g, '$1')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .trim();
}

function normalizeKey(value: string): string {
  const normalized = normalizePath(stripMarkdownExtension(value));
  if (!normalized) {
    return '';
  }

  return normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function slugifyLookupKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s/g, '-');
}

function slugifyHeadingFragment(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function splitRawInternalLink(rawValue: string): {
  basePath: string;
  query: string;
  fragment?: string;
} {
  const hashIndex = rawValue.indexOf('#');
  const beforeHash = hashIndex >= 0 ? rawValue.slice(0, hashIndex) : rawValue;
  const fragment = hashIndex >= 0 ? rawValue.slice(hashIndex + 1) || undefined : undefined;
  const queryIndex = beforeHash.indexOf('?');

  return {
    basePath: queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash,
    query: queryIndex >= 0 ? beforeHash.slice(queryIndex) : '',
    fragment,
  };
}

function getBasename(value: string): string {
  const normalized = normalizePath(value);
  if (!normalized) {
    return '';
  }

  const segments = normalized.split('/');
  return segments[segments.length - 1] ?? normalized;
}

function getDirname(value: string): string {
  const normalized = normalizePath(value);
  if (!normalized) {
    return '';
  }

  const segments = normalized.split('/');
  segments.pop();
  return segments.join('/');
}

function resolvePosixLikePath(baseDirectory: string, relativePath: string): string {
  const resolvedSegments: string[] = [];

  for (const segment of [...baseDirectory.split('/'), ...relativePath.split('/')]) {
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

function resolveRelativeBasePath(basePath: string, currentRoutePath?: string): string {
  const normalizedBasePath = normalizePath(stripMarkdownExtension(basePath));
  if (!normalizedBasePath) {
    return '';
  }

  if (!/^(?:\.\.\/|\.\/)/.test(normalizedBasePath) || !currentRoutePath) {
    return normalizedBasePath;
  }

  const currentDirectory = getDirname(currentRoutePath.replace(/\.html$/i, ''));
  return resolvePosixLikePath(currentDirectory, normalizedBasePath);
}

function classifyFragment(fragment?: string): {
  fragmentRaw: string | null;
  fragmentCanonical: string | null;
  fragmentType: InternalLinkFragmentType;
} {
  if (!fragment) {
    return {
      fragmentRaw: null,
      fragmentCanonical: null,
      fragmentType: null,
    };
  }

  const decodedFragment = safeDecodeURIComponent(fragment);
  if (!decodedFragment) {
    return {
      fragmentRaw: null,
      fragmentCanonical: null,
      fragmentType: null,
    };
  }

  if (decodedFragment.startsWith('^')) {
    return {
      fragmentRaw: decodedFragment,
      fragmentCanonical: decodedFragment,
      fragmentType: 'block',
    };
  }

  return {
    fragmentRaw: decodedFragment,
    fragmentCanonical: slugifyHeadingFragment(decodedFragment),
    fragmentType: 'heading',
  };
}

function normalizeRoutePath(pathname: string): string {
  const stripped = safeDecodeURI(pathname).replace(/\/+$/, '').trim();
  return stripped || '/';
}

function toInternalHref(pathname: string, query: string, fragmentCanonical: string | null): string {
  const hash = fragmentCanonical ? `#${fragmentCanonical}` : '';
  return `${pathname}${query}${hash}`;
}

function getPathKeys(page: ManifestPage): Array<[InternalLinkMatchSource, string]> {
  const keys: Array<[InternalLinkMatchSource, string]> = [];

  if (page.route) {
    keys.push(['route', normalizeKey(page.route)]);
  }
  if (page.relativePath) {
    keys.push(['relativePath', normalizeKey(page.relativePath)]);
  }
  if (page.vaultPath) {
    keys.push(['vaultPath', normalizeKey(page.vaultPath)]);
  }
  if (page.slug?.value) {
    keys.push(['slug', normalizeKey(page.slug.value)]);
  }

  return keys.filter(([, key]) => key.length > 0);
}

function getTextKeys(page: ManifestPage): Array<[InternalLinkMatchSource, string]> {
  const keys: Array<[InternalLinkMatchSource, string]> = [];
  const basename = getBasename(page.relativePath || page.vaultPath || page.route || '');

  if (basename) {
    keys.push(['basename', slugifyLookupKey(basename)]);
  }
  if (page.title) {
    keys.push(['title', slugifyLookupKey(page.title)]);
  }
  for (const alias of page.aliases ?? []) {
    if (alias?.trim()) {
      keys.push(['alias', slugifyLookupKey(alias)]);
    }
  }

  return keys.filter(([, key]) => key.length > 0);
}

function uniquePages(
  matches: Array<{ page: ManifestPage; source: InternalLinkMatchSource }>
): Array<{
  page: ManifestPage;
  source: InternalLinkMatchSource;
}> {
  return Array.from(new Map(matches.map((match) => [match.page.id, match])).values());
}

function matchPathKeys(
  pages: ManifestPage[],
  predicate: (key: string) => boolean
): Array<{ page: ManifestPage; source: InternalLinkMatchSource }> {
  const matches: Array<{ page: ManifestPage; source: InternalLinkMatchSource }> = [];

  for (const page of pages) {
    for (const [source, key] of getPathKeys(page)) {
      if (predicate(key)) {
        matches.push({ page, source });
      }
    }
  }

  return uniquePages(matches);
}

function matchTextKeys(
  pages: ManifestPage[],
  predicate: (key: string) => boolean
): Array<{ page: ManifestPage; source: InternalLinkMatchSource }> {
  const matches: Array<{ page: ManifestPage; source: InternalLinkMatchSource }> = [];

  for (const page of pages) {
    for (const [source, key] of getTextKeys(page)) {
      if (predicate(key)) {
        matches.push({ page, source });
      }
    }
  }

  return uniquePages(matches);
}

function buildResolution(
  rawValue: string,
  normalizedBasePath: string,
  query: string,
  fragment: ReturnType<typeof classifyFragment>,
  match?: { page: ManifestPage; source: InternalLinkMatchSource },
  ambiguousCandidates?: ManifestPage[]
): CanonicalInternalLinkResolution {
  if (match) {
    const resolvedRoute = match.page.route;
    return {
      raw: rawValue,
      normalizedBasePath,
      query,
      ...fragment,
      page: match.page,
      resolvedRoute,
      resolvedHref: toInternalHref(resolvedRoute, query, fragment.fragmentCanonical),
      aliasMatched: match.source === 'alias',
      resolved: true,
      matchSource: match.source,
      unresolvedReason: null,
    };
  }

  return {
    raw: rawValue,
    normalizedBasePath,
    query,
    ...fragment,
    resolvedRoute: null,
    resolvedHref: null,
    aliasMatched: false,
    resolved: false,
    matchSource: null,
    unresolvedReason: ambiguousCandidates?.length
      ? 'ambiguous'
      : normalizedBasePath
        ? 'not-found'
        : 'empty',
    ambiguousCandidates,
  };
}

export function normalizeManifestWikilinkTarget(target: string): string {
  const split = splitRawInternalLink(target);
  const normalizedBasePath = resolveRelativeBasePath(split.basePath);
  return normalizedBasePath
    ? `${normalizedBasePath}${split.fragment ? `#${safeDecodeURIComponent(split.fragment)}` : ''}`
    : '';
}

export function resolveCanonicalInternalLink(
  rawValue: string,
  pages: ManifestPage[],
  currentRoutePath?: string
): CanonicalInternalLinkResolution {
  const split = splitRawInternalLink(rawValue);
  const normalizedBasePath = resolveRelativeBasePath(split.basePath || rawValue, currentRoutePath);
  const fragment = classifyFragment(split.fragment);

  if (!normalizedBasePath) {
    return buildResolution(rawValue, normalizedBasePath, split.query, fragment);
  }

  const exactMatches = matchPathKeys(pages, (key) => key === normalizeKey(normalizedBasePath));
  if (exactMatches.length === 1) {
    return buildResolution(rawValue, normalizedBasePath, split.query, fragment, exactMatches[0]);
  }
  if (exactMatches.length > 1) {
    return buildResolution(
      rawValue,
      normalizedBasePath,
      split.query,
      fragment,
      undefined,
      exactMatches.map((match) => match.page)
    );
  }

  if (normalizedBasePath.includes('/')) {
    const tailMatches = matchPathKeys(pages, (key) =>
      key.endsWith(`/${normalizeKey(normalizedBasePath)}`)
    );
    if (tailMatches.length === 1) {
      return buildResolution(rawValue, normalizedBasePath, split.query, fragment, {
        ...tailMatches[0],
        source: 'tail',
      });
    }
    if (tailMatches.length > 1) {
      return buildResolution(
        rawValue,
        normalizedBasePath,
        split.query,
        fragment,
        undefined,
        tailMatches.map((match) => match.page)
      );
    }
  }

  const basename = getBasename(normalizedBasePath);
  const basenameKey = normalizeKey(basename);
  const basenameSlug = slugifyLookupKey(basename);

  const basenameMatches = matchPathKeys(
    pages,
    (key) => key === basenameKey || key.endsWith(`/${basenameKey}`)
  );
  if (basenameMatches.length === 1) {
    return buildResolution(rawValue, normalizedBasePath, split.query, fragment, basenameMatches[0]);
  }
  if (basenameMatches.length > 1) {
    return buildResolution(
      rawValue,
      normalizedBasePath,
      split.query,
      fragment,
      undefined,
      basenameMatches.map((match) => match.page)
    );
  }

  const textMatches = matchTextKeys(pages, (key) => key === basenameSlug);
  if (textMatches.length === 1) {
    return buildResolution(rawValue, normalizedBasePath, split.query, fragment, textMatches[0]);
  }
  if (textMatches.length > 1) {
    return buildResolution(
      rawValue,
      normalizedBasePath,
      split.query,
      fragment,
      undefined,
      textMatches.map((match) => match.page)
    );
  }

  return buildResolution(rawValue, normalizedBasePath, split.query, fragment);
}

export function parseInternalHref(
  href: string,
  currentPathname = '/',
  currentSearch = ''
): ParsedInternalHref | null {
  const trimmed = href.trim();
  if (!trimmed) {
    return null;
  }

  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(trimmed)) {
    return null;
  }

  const basePath = normalizeRoutePath(currentPathname);
  const base = new URL(`${basePath}${currentSearch || ''}`, INTERNAL_URL_BASE);
  const parsed = new URL(trimmed, base);

  if (parsed.origin !== INTERNAL_URL_BASE) {
    return null;
  }

  const path = normalizeRoutePath(parsed.pathname);
  const fragment = parsed.hash ? safeDecodeURIComponent(parsed.hash.slice(1)) : null;
  const normalizedHref = `${path}${parsed.search}${parsed.hash}`;

  return {
    raw: href,
    path,
    search: parsed.search,
    fragment,
    normalizedHref,
    isFragmentOnly: trimmed.startsWith('#'),
  };
}
