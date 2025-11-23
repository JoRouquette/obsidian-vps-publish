import { Manifest } from '../../domain/models/Manifest';
import { ManifestRepository } from '../../domain/ports/ManifestRepository';
import { Query } from './Query';

export class LoadManifestQuery implements Query<void, Manifest> {
  constructor(private readonly repository: ManifestRepository) {}

  execute(params: void): Promise<Manifest> {
    return this.repository.load();
  }
}
