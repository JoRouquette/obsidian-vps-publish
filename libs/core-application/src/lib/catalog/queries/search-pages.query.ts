import { QueryHandler } from '../../common/query-handler';
import type { Manifest, ManifestPage } from '@core-domain';

export interface SearchPagesQuery {
  manifest: Manifest;
  query: string;
}

export class SearchPagesHandler implements QueryHandler<SearchPagesQuery, ManifestPage[]> {
  async handle(params: SearchPagesQuery): Promise<ManifestPage[]> {
    const { manifest, query } = params;
    const normalized = query.trim().toLowerCase();

    if (!normalized) return manifest.pages;

    return manifest.pages.filter(
      (p) =>
        (p.title ?? '').toLowerCase().includes(normalized) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(normalized))
    );
  }
}
