import { type Manifest } from '@core-domain';

/**
 * Gestion de l'indexation du site (manifest + index des dossiers).
 */
export interface ManifestPort {
  /**
   * Charge le manifest s'il existe, ou null sinon.
   */
  load(): Promise<Manifest | null>;

  /**
   * Sauvegarde le manifest du site.
   * @param manifest Le manifest à sauvegarder.
   */
  save(manifest: Manifest): Promise<void>;

  /**
   * Reconstruit tous les index du site à partir du manifest.
   * @param manifest Le manifest du site.
   * @param customIndexesHtml Optional custom HTML content for indexes, keyed by folder path
   */
  rebuildIndex(manifest: Manifest, customIndexesHtml?: Map<string, string>): Promise<void>;

  /**
   * Atomically update the manifest using a callback.
   * Ensures exclusive access to prevent concurrent write conflicts.
   * @param updater Function that receives current manifest and returns updated manifest
   */
  atomicUpdate(updater: (current: Manifest | null) => Promise<Manifest>): Promise<void>;
}
