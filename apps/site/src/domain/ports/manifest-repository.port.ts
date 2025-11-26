import { Manifest } from '../models/manifest';

export interface ManifestRepository {
  load(): Promise<Manifest>;
}
