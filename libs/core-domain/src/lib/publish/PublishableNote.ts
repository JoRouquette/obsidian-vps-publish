import type { AssetRef } from './AssetRef';
import { NoteCore } from './NoteCore';
import { NoteRoutingInfo } from './NoteRoutingInfo';
import type { ResolvedWikilink } from './ResolvedWikilink';
import type { WikilinkRef } from './WikilinkRef';

/**
 * PublishableNote = noyau + capacités OPTIONNELLES.
 *
 * Chaque usecase ajoute son petit morceau (routing, assets, wikilinks, etc.)
 * en enrichissant la note, sans créer de hiérarchie de classes.
 */
export interface PublishableNote extends NoteCore {
  routing: NoteRoutingInfo;
  assets?: AssetRef[];
  wikilinks?: WikilinkRef[];
  resolvedWikilinks?: ResolvedWikilink[];
}
