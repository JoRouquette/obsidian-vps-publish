import { ManifestPage } from './ManifestPage';

export interface Manifest {
  sessionId: string;
  createdAt: Date;
  lastUpdatedAt: Date;
  pages: ManifestPage[];
}
