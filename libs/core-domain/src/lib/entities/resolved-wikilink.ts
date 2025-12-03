import type { WikilinkKind } from './wikilink-ref';

export interface ResolvedWikilink {
  /**
   * Where the wikilink was detected (note content or frontmatter).
   */
  origin?: 'content' | 'frontmatter';
  /**
   * Path of the frontmatter property that contains the link (if any).
   */
  frontmatterPath?: string;
  raw: string;
  target: string;
  path: string;
  subpath?: string;
  alias?: string;
  kind: WikilinkKind;
  isResolved: boolean;
  targetNoteId?: string;
  href?: string;
}
