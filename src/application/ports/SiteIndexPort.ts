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
  /** Écrit/écrase le manifest complet. */
  saveManifest(manifest: Manifest): Promise<void>;

  /** Reconstruit TOUS les index de dossiers (racine + chaque dossier) à partir du manifest. */
  rebuildAllIndexes(manifest: Manifest): Promise<void>;
}
