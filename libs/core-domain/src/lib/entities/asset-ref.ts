import type { AssetKind } from './asset-kind';
import type { AssetDisplayOptions } from './asset-display-options';

export interface AssetRef {
  /**
   * Texte brut de l'embed, ex: "![[Tenebra1.jpg|right|300]]"
   */
  raw: string;
  /**
   * Chemin tel qu'écrit dans l'embed (sans modifiers), ex: "Tenebra1.jpg".
   */
  target: string;
  /**
   * Type d'asset déduit de l'extension.
   */
  kind: AssetKind;
  /**
   * Options d'affichage déduites des modifiers (ITS, etc.).
   */
  display: AssetDisplayOptions;
}
