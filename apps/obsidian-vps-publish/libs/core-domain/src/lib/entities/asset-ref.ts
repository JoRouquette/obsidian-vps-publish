import type { AssetDisplayOptions } from './asset-display-options';
import type { AssetKind } from './asset-kind';

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
   * Syntax that produced the asset reference.
   * - `obsidian-embed`: ![[...]]
   * - `markdown-image`: ![alt](path)
   * - `html-ref`: HTML attribute such as <img src="..."> or <a href="...">
   * - `leaflet-overlay`: synthetic asset reference coming from Leaflet metadata
   *
   * Invariant:
   * - only `obsidian-embed` is transformed into backend-rendered <figure> blocks
   * - other syntaxes must keep their original HTML/Markdown structure and only
   *   contribute to upload + final URL canonicalization.
   */
  sourceSyntax?: 'obsidian-embed' | 'markdown-image' | 'html-ref' | 'leaflet-overlay';
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
