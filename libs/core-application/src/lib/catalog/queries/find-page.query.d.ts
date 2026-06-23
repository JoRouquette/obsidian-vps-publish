import type { Manifest, ManifestPage } from '@core-domain';
import { type QueryHandler } from '../../common/query-handler';
export interface FindPageQuery {
    manifest: Manifest;
    slugOrRoute: string;
}
export declare class FindPageHandler implements QueryHandler<FindPageQuery, ManifestPage | undefined> {
    handle(params: FindPageQuery): Promise<ManifestPage | undefined>;
}
//# sourceMappingURL=find-page.query.d.ts.map