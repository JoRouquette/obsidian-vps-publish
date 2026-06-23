import type { AssetRef } from './asset-ref';
import type { PublishableNote } from './publishable-note';
export type NoteWithAssets = PublishableNote & {
    assets: AssetRef[];
};
export declare function isNoteWithAssets(note: PublishableNote): note is NoteWithAssets;
export declare function extractNoteWithAssets(note: PublishableNote): NoteWithAssets | null;
export declare function extractNotesWithAssets(notes: PublishableNote[]): NoteWithAssets[];
//# sourceMappingURL=note-with-assets.d.ts.map