import { Manifest } from '../../../domain/entities/Manifest';

/**
 * Gestion de l'indexation du site (manifest + index des dossiers).
 */
export interface ManifestPort {
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
