import type { PublishableNote } from './publishable-note';
import type { ResolvedWikilink } from './resolved-wikilink';
import type { WikilinkRef } from './wikilink-ref';

export interface NoteWithWikilinks extends PublishableNote {
  wikilinks: WikilinkRef[];
  resolvedWikilinks: ResolvedWikilink[];
}
