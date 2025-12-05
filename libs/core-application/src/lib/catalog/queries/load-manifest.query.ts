import { type Manifest, type ManifestRepository } from '@core-domain';

import { type QueryHandler } from '../../common/query-handler';

export class LoadManifestHandler implements QueryHandler<void, Manifest> {
  constructor(private readonly repository: ManifestRepository) {}

  async handle(): Promise<Manifest> {
    return this.repository.load();
  }
}
