import { Manifest } from '../../domain/models/manifest';
import { Page } from '../../domain/models/page';
import { Query } from './query';

export interface FindPageQueryParams {
  manifest: Manifest;
  slugOrRoute: string;
}

export class FindPageQuery implements Query<FindPageQueryParams, Page | undefined> {
  execute(params: FindPageQueryParams): Promise<Page | undefined> {
    const { manifest, slugOrRoute } = params;
    return Promise.resolve(
      manifest.pages.find((p) => p.slug.value === slugOrRoute || p.route === slugOrRoute)
    );
  }
}
