import { type Manifest, type ManifestRepository } from '@core-domain';
import { type QueryHandler } from '../../common/query-handler';
export declare class LoadManifestHandler implements QueryHandler<void, Manifest> {
    private readonly repository;
    constructor(repository: ManifestRepository);
    handle(): Promise<Manifest>;
}
//# sourceMappingURL=load-manifest.query.d.ts.map