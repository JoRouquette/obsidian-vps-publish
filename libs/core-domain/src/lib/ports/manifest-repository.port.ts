import type { Manifest } from '../entities/manifest';

export interface ManifestRepository {
  load(): Promise<Manifest>;
}
