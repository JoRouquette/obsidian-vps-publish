import type { WikilinkKind } from './wikilink-ref';

export interface ResolvedWikilink {
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
