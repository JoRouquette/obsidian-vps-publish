import { Manifest } from '../models/Manifest';

export interface ManifestRepository {
  load(): Promise<Manifest>;
}
