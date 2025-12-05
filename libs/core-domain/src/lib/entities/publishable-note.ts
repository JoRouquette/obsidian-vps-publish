import type { AssetRef } from './asset-ref';
import type { NoteCore } from './note-core';
import type { NoteEligibility } from './note-eligibility';
import type { NoteRoutingInfo } from './note-routing-info';
import type { ResolvedWikilink } from './resolved-wikilink';

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
