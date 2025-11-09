import { PublishedPage } from '../../domain/entities/PublishedPage';

export interface ManifestPage {
  route: string;
  title: string;
  description?: string;
  tags?: string[];
  publishedAt: Date;
  updatedAt: Date;
  slug: string;
}

export interface Manifest {
  pages: ManifestPage[];
}

/**
 * Gestion de l'indexation du site (manifest + index des dossiers).
 */
export interface SiteIndexPort {
  saveManifest(manifest: Manifest): Promise<void>;

  rebuildAllIndexes(manifest: Manifest): Promise<void>;
}
