/**
 * Représente un embed de type Obsidian `![[...]]` qui pointe vers un asset
 * (image, audio, video, pdf, etc.).
 *
 * NB: ce n'est PAS un wikilink vers une note, ça c'est géré par detect-wikilinks.
 */

export interface AssetRef {
  /**
   * Texte brut de l’embed, ex: "![[Tenebra1.jpg|right|300]]"
   */
  raw: string;

  /**
   * Chemin tel qu’écrit dans l’embed (sans modifiers).
   * ex: "Tenebra1.jpg" ou "divinites/Tenebra1.jpg"
   */
  target: string;

  /**
   * Type d’asset déduit de l’extension.
   *
   */
  kind: AssetKind;

  /**
   * Options d’affichage déduites des modifiers (ITS, etc.).
   */
  display: AssetDisplayOptions;
}

export type AssetKind = 'image' | 'audio' | 'video' | 'pdf' | 'other';

export interface AssetDisplayOptions {
  alignment?: AssetAlignment;
  width?: number; // px
  classes: string[]; // classes ITS ou CSS arbitraires
  rawModifiers: string[]; // tous les segments après le chemin, bruts
}

export type AssetAlignment = 'left' | 'right' | 'center';
