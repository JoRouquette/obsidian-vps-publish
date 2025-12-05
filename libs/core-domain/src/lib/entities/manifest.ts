import type { ManifestPage } from './manifest-page';

export interface Manifest {
  sessionId: string;
  createdAt: Date;
  lastUpdatedAt: Date;
  pages: ManifestPage[];
}

export const defaultManifest: Manifest = {
  sessionId: '',
  createdAt: new Date(0),
  lastUpdatedAt: new Date(0),
  pages: [],
};
