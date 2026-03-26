import type { AssetRef } from './asset-ref';
import type { LeafletBlock } from './leaflet-block';
import type { NoteCore } from './note-core';
import type { NoteEligibility } from './note-eligibility';

/**
 * Lean note payload used by the API-owned deterministic transform path.
 * It keeps raw source material plus Obsidian-only enrichments and omits
 * deterministic fields the API will recompute authoritatively.
 */
export interface SourcePackageNote extends NoteCore {
  publishedAt: Date;
  eligibility: NoteEligibility;
  assets?: AssetRef[];
  leafletBlocks?: LeafletBlock[];
}
