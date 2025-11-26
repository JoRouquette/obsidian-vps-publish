// Représente un wikilink brut détecté dans le contenu markdown.
// Syntaxe type Obsidian: [[cible]], [[cible|alias]], [[cible#heading]], etc.

export type WikilinkKind = 'note' | 'file';

export interface WikilinkRef {
  /**
   * Wikilink tel qu'il apparaît dans le markdown.
   * ex: "[[Thormak]]", "[[puissances/Thormak#Bio|Le Briseur]]"
   */
  raw: string;

  /**
   * Partie "cible" sans l'alias, c'est-à-dire le contenu
   * à gauche de "|" s'il existe.
   * ex:
   *  - "Thormak"
   *  - "puissances/Thormak#Bio"
   */
  target: string;

  /**
   * Chemin principal utilisé pour la résolution, sans subpath.
   * -> tout ce qui est avant un éventuel "#".
   * ex:
   *  - "Thormak"
   *  - "puissances/Thormak"
   */
  path: string;

  /**
   * Partie après le "#", quand présente.
   * ex:
   *  - "Bio"
   *  - "^block-id"
   */
  subpath?: string;

  /**
   * Alias d'affichage éventuel (la partie après "|").
   * ex: "Le Briseur"
   */
  alias?: string;

  /**
   * Classification grossière : "note" (par défaut) ou "file"
   * si la cible ressemble à un fichier (extension).
   */
  kind: WikilinkKind;
}
