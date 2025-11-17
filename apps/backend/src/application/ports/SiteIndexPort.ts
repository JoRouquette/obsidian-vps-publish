import { LoggerPort } from './LoggerPort';

export interface ManifestPage {
  id: string;
  title: string;
  slug: string;
  route: string;
  description?: string;
  publishedAt: Date;
}

export interface Manifest {
  pages: ManifestPage[];
}

/**
 * Gestion de l'indexation du site (manifest + index des dossiers).
 */
export interface SiteIndexPort {
  saveManifest(manifest: Manifest, logger?: LoggerPort): Promise<void>;

  rebuildAllIndexes(manifest: Manifest, logger?: LoggerPort): Promise<void>;
}
