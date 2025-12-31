/**
 * Infos de routing calculées pour une note.
 * C’est ce que compute-routing va produire.
 */

export interface NoteRoutingInfo {
  /**
   * Nom de fichier slugifié (sans extension).
   * ex: "thormak"
   */
  slug: string;

  /**
   * Chemin de dossiers slugifiés depuis la route (sans slug).
   * ex: "puissances/divinites" ou "" si aucun dossier.
   */
  path: string;

  /**
   * Route de base configurée pour ce folder, normalisée.
   * ex: "/codex", "/tresors"
   */
  routeBase: string;

  /**
   * Chemin logique de la page côté site, sans "index.html".
   * ex: "/codex/puissances/divinites/thormak"
   */
  fullPath: string;

  /**
   * Optional display name for the folder this note belongs to
   * Propagated from RouteNode.displayName
   * Used in breadcrumbs and folder indexes
   */
  folderDisplayName?: string;
}
