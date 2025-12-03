import type { AssetKind } from './asset-kind';
import type { AssetDisplayOptions } from './asset-display-options';

export interface AssetRef {
  /**
   * Where the asset reference was detected (note content or frontmatter).
   */
  origin?: 'content' | 'frontmatter';
  /**
   * Path of the frontmatter property that contains the asset reference (if any).
   */
  frontmatterPath?: string;
  /**
   * Raw embed text, e.g. "![[Tenebra1.jpg|right|300]]".
   */
  raw: string;
  /**
   * Path as written in the embed (without modifiers), e.g. "Tenebra1.jpg".
   */
  target: string;
  /**
   * Asset kind inferred from the extension.
   */
  kind: AssetKind;
  /**
   * Display options inferred from modifiers (ITS, etc.).
   */
  display: AssetDisplayOptions;
}
