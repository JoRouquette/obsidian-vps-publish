import type { ManifestPage } from '../entities/manifest-page';
export type InternalLinkFragmentType = 'heading' | 'block' | 'unknown' | null;
export type InternalLinkMatchSource = 'route' | 'relativePath' | 'vaultPath' | 'slug' | 'title' | 'alias' | 'tail' | 'basename';
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
export declare function normalizeManifestWikilinkTarget(target: string): string;
export declare function resolveCanonicalInternalLink(rawValue: string, pages: ManifestPage[], currentRoutePath?: string): CanonicalInternalLinkResolution;
export declare function parseInternalHref(href: string, currentPathname?: string, currentSearch?: string): ParsedInternalHref | null;
//# sourceMappingURL=internal-link-resolution.util.d.ts.map