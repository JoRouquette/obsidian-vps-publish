import type { ManifestPage } from './manifest-page';

export interface Manifest {
  sessionId: string;
  createdAt: Date;
  lastUpdatedAt: Date;
  pages: ManifestPage[];
  /**
   * Optional mapping of route paths to their display names
   * Used to preserve display names for folders even when no pages exist directly in them
   * Example: { "/tresors": "Trésors", "/pantheon": "Panthéon" }
   */
  folderDisplayNames?: Record<string, string>;
}

export const defaultManifest: Manifest = {
  sessionId: '',
  createdAt: new Date(0),
  lastUpdatedAt: new Date(0),
  pages: [],
};
