import { Manifest } from '../../domain/models/Manifest';
import { Page } from '../../domain/models/Page';
import { Query } from './Query';

export interface SearchPagesQueryParams {
  manifest: Manifest;
  query: string;
}

export class SearchPagesQuery implements Query<SearchPagesQueryParams, Page[]> {
  execute(params: SearchPagesQueryParams): Promise<Page[]> {
    const { manifest, query } = params;
    const q = query.trim().toLowerCase();

    if (!q) {
      return Promise.resolve(manifest.pages);
    }

    return Promise.resolve(
      manifest.pages.filter(
        (p) =>
          (p.title ?? '').toLowerCase().includes(q) ||
          (p.tags ?? []).some((t) => t.toLowerCase().includes(q))
      )
    );
  }
}
