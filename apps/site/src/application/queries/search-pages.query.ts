import { Manifest } from '../../domain/models/manifest';
import { Page } from '../../domain/models/page';
import { Query } from './query';

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
