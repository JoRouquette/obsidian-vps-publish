// Represents a raw wikilink detected in markdown content.
// Obsidian-like syntax: [[target]], [[target|alias]], [[target#heading]], etc.

export type WikilinkKind = 'note' | 'file';

export interface WikilinkRef {
  /**
   * Where the wikilink was detected (note content or frontmatter).
   */
  origin?: 'content' | 'frontmatter';
  /**
   * Path of the frontmatter property that contains the link (if any).
   */
  frontmatterPath?: string;
  /**
   * Wikilink as it appears in markdown, e.g. "[[Thormak]]".
   */
  raw: string;

  /**
   * Target part without the alias (left side of "|" when present).
   */
  target: string;

  /**
   * Main path used for resolution, without subpath (before "#").
   */
  path: string;

  /**
   * Optional part after "#", e.g. "Bio" or "^block-id".
   */
  subpath?: string;

  /**
   * Optional display alias (the part after "|").
   */
  alias?: string;

  /**
   * Coarse classification: "note" (default) or "file" if it looks like a file.
   */
  kind: WikilinkKind;
}
