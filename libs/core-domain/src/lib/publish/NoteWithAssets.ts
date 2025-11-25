import type { AssetRef } from './AssetRef';
import { PublishableNote } from './PublishableNote';

export type NoteWithAssets = PublishableNote & {
  assets: AssetRef[];
};

export function isNoteWithAssets(
  note: PublishableNote
): note is NoteWithAssets {
  return (note as any).assets !== undefined;
}

export function extractNoteWithAssets(
  note: PublishableNote
): NoteWithAssets | null {
  if (isNoteWithAssets(note)) {
    return note;
  }
  return null;
}

export function extractNotesWithAssets(
  notes: PublishableNote[]
): NoteWithAssets[] {
  return notes.filter(isNoteWithAssets);
}
