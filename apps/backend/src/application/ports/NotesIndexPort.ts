import { IndexPort } from './IndexPort';
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
export interface NotesIndexPort extends IndexPort {
  /**
   * Sauvegarde le manifest du site.
   * @param manifest Le manifest à sauvegarder.
   */
  save(manifest: Manifest): Promise<void>;
  /**
   * Reconstruit tous les index du site à partir du manifest.
   * @param manifest Le manifest du site.
   */
  rebuildIndex(manifest: Manifest): Promise<void>;
}
