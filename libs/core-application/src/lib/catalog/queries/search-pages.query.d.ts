import type { Manifest, ManifestPage } from '@core-domain';
import { type QueryHandler } from '../../common/query-handler';
export interface SearchPagesQuery {
    manifest: Manifest;
    query: string;
}
export declare class SearchPagesHandler implements QueryHandler<SearchPagesQuery, ManifestPage[]> {
    handle(params: SearchPagesQuery): Promise<ManifestPage[]>;
}
//# sourceMappingURL=search-pages.query.d.ts.map