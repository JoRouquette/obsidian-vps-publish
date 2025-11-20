import { Manifest } from '../../domain/models/Manifest';
import { ManifestRepository } from '../../domain/ports/ManifestRepository';

export class LoadManifestUseCase {
  constructor(private readonly repo: ManifestRepository) {}

  exec(): Promise<Manifest> {
    return this.repo.load();
  }
}
