import { QueryHandler } from '../../common/query-handler';
import type { Manifest, ManifestPage } from '@core-domain';

export interface FindPageQuery {
  manifest: Manifest;
  slugOrRoute: string;
}

export class FindPageHandler implements QueryHandler<FindPageQuery, ManifestPage | undefined> {
  async handle(params: FindPageQuery): Promise<ManifestPage | undefined> {
    const { manifest, slugOrRoute } = params;
    return manifest.pages.find((p) => p.slug.value === slugOrRoute || p.route === slugOrRoute);
  }
}
