import { type PublishableNote, type SourcePackageNote } from '@core-domain';

import { type UploadSessionNote } from '../commands/upload-notes.command';

export function buildUploadSessionNotes(notes: PublishableNote[]): UploadSessionNote[] {
  return notes.map((note): SourcePackageNote => {
    const { noteId, title, vaultPath, relativePath, content, frontmatter, folderConfig } = note;

    return {
      noteId,
      title,
      vaultPath,
      relativePath,
      content,
      frontmatter,
      folderConfig,
      publishedAt: note.publishedAt,
      eligibility: note.eligibility,
      assets: note.assets,
      leafletBlocks: note.leafletBlocks,
    };
  });
}
