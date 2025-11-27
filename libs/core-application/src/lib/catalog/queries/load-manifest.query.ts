import { QueryHandler } from '../../common/query-handler';
import { Manifest, ManifestRepository } from '@core-domain';

export class LoadManifestHandler implements QueryHandler<void, Manifest> {
  constructor(private readonly repository: ManifestRepository) {}

  async handle(): Promise<Manifest> {
    return this.repository.load();
  }
}
