import type { WikilinkKind } from './WikilinkRef';

/**
 * Wikilink après tentative de résolution vers une note publiée.
 * Ne contient PAS l'id de la note d'origine, seulement la cible.
 */
export interface ResolvedWikilink {
  raw: string;
  target: string;
  path: string;
  subpath?: string;
  alias?: string;
  kind: WikilinkKind;

  /**
   * true si la cible correspond à une note publiée connue,
   * false sinon (lien "cassé" ou désactivé).
   */
  isResolved: boolean;

  /**
   * ID de la note cible dans l'espace de publication (celui utilisé pour l'upload).
   */
  targetNoteId?: string;

  /**
   * URL finale (chemin relatif) prévue pour ce lien.
   * ex: "/codex/puissances/divinites/thormak#bio"
   */
  href?: string;
}
