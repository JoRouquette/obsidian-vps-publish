import type { ManifestPage } from '@core-domain';
import {
  type InternalLinkFragmentType,
  type InternalLinkMatchSource,
  normalizeManifestWikilinkTarget as normalizeSharedManifestWikilinkTarget,
  resolveCanonicalInternalLink,
} from '@core-domain';

export interface ResolvedManifestLinkCandidate {
  page?: ManifestPage;
  query?: string;
  fragment?: string;
  fragmentCanonical?: string;
  fragmentType?: InternalLinkFragmentType;
  normalizedBasePath: string;
  matchSource?: InternalLinkMatchSource | null;
  aliasMatched?: boolean;
  unresolvedReason?: 'empty' | 'not-found' | 'ambiguous' | null;
  ambiguousCandidates?: ManifestPage[];
}

export function normalizeManifestWikilinkTarget(target: string): string {
  return normalizeSharedManifestWikilinkTarget(target).replace(/^\/+/, '');
}

function humanizeRouteSegment(segment: string): string {
  if (!segment) {
    return '';
  }

  const decoded = decodeURIComponent(segment).replace(/[-_]+/g, ' ').trim();
  return decoded ? decoded.charAt(0).toUpperCase() + decoded.slice(1) : '';
}

function buildSyntheticFolderIndexPages(
  pages: ManifestPage[],
  folderDisplayNames?: Record<string, string>
): ManifestPage[] {
  const syntheticPages: ManifestPage[] = [];
  const existingRoutes = new Set(pages.map((page) => page.route));
  const seenRoutes = new Set<string>();

  for (const page of pages) {
    const segments = page.route.split('/').filter(Boolean);
    let currentSegments: string[] = [];

    for (let i = 0; i < segments.length - 1; i++) {
      currentSegments = [...currentSegments, segments[i]];
      const folderRoute = `/${currentSegments.join('/')}`;
      const indexRoute = `${folderRoute}/index`;

      if (existingRoutes.has(indexRoute) || seenRoutes.has(indexRoute)) {
        continue;
      }

      const lastSegment = currentSegments[currentSegments.length - 1] ?? '';
      const displayName = folderDisplayNames?.[folderRoute] ?? humanizeRouteSegment(lastSegment);
      const relativePath = currentSegments.join('/');
      const aliases = Array.from(
        new Set([displayName, humanizeRouteSegment(lastSegment), decodeURIComponent(lastSegment)])
      ).filter(Boolean);

      syntheticPages.push({
        id: `__generated-index__${folderRoute}`,
        title: displayName || humanizeRouteSegment(lastSegment) || relativePath,
        route: indexRoute,
        slug: { value: 'index' } as ManifestPage['slug'],
        publishedAt: new Date(0),
        relativePath,
        aliases: aliases.length > 0 ? aliases : undefined,
        isCustomIndex: true,
      });

      seenRoutes.add(indexRoute);
    }
  }

  return syntheticPages;
}

export function resolveManifestLinkCandidate(
  rawValue: string,
  pages: ManifestPage[],
  currentRoutePath?: string,
  folderDisplayNames?: Record<string, string>
): ResolvedManifestLinkCandidate {
  const resolved = resolveCanonicalInternalLink(rawValue, pages, currentRoutePath);
  const fallbackResolved =
    !resolved.resolved && resolved.unresolvedReason === 'not-found'
      ? resolveCanonicalInternalLink(
          rawValue,
          buildSyntheticFolderIndexPages(pages, folderDisplayNames),
          currentRoutePath
        )
      : undefined;
  const effectiveResolved =
    fallbackResolved &&
    (fallbackResolved.resolved || fallbackResolved.unresolvedReason === 'ambiguous')
      ? fallbackResolved
      : resolved;
  return {
    page: effectiveResolved.page,
    query: effectiveResolved.query || undefined,
    fragment: effectiveResolved.fragmentRaw ?? undefined,
    fragmentCanonical: effectiveResolved.fragmentCanonical ?? undefined,
    fragmentType: effectiveResolved.fragmentType ?? undefined,
    normalizedBasePath: effectiveResolved.normalizedBasePath,
    matchSource: effectiveResolved.matchSource,
    aliasMatched: effectiveResolved.aliasMatched,
    unresolvedReason: effectiveResolved.unresolvedReason,
    ambiguousCandidates: effectiveResolved.ambiguousCandidates,
  };
}
