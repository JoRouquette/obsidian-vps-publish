import { Manifest } from '../../domain/models/manifest';
import { ManifestRepository } from '../../domain/ports/manifest-repository.port';
import { Query } from './query';

export class LoadManifestQuery implements Query<void, Manifest> {
  constructor(private readonly repository: ManifestRepository) {}

  execute(params: void): Promise<Manifest> {
    return this.repository.load();
  }
}
