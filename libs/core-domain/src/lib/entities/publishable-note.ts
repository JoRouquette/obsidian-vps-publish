import type { AssetRef } from './asset-ref';
import { NoteCore } from './note-core';
import { NoteEligibility } from './note-eligibility';
import { NoteRoutingInfo } from './note-routing-info';
import { ResolvedWikilink } from './resolved-wikilink';
import type { WikilinkRef } from './wikilink-ref';

/**
 * PublishableNote = noyau + capacités OPTIONNELLES.
 *
 * Chaque usecase ajoute son petit morceau (routing, assets, wikilinks, etc.)
 * en enrichissant la note, sans créer de hiérarchie de classes.
 */
export interface PublishableNote extends NoteCore {
  routing: NoteRoutingInfo;
  publishedAt: Date;
  eligibility: NoteEligibility;
  assets?: AssetRef[];
  resolvedWikilinks?: ResolvedWikilink[];
}
