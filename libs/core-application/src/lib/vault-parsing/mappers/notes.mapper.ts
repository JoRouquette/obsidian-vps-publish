import { CollectedNote, NoteEligibility, NoteRoutingInfo } from '@core-domain';
import { Mapper } from '@core-domain/entities/mapper';
import { PublishableNote } from '@core-domain/entities/publishable-note';

export class NotesMapper implements Mapper<CollectedNote, PublishableNote> {
  map(note: CollectedNote): PublishableNote {
    // Map all NoteCore fields directly
    const {
      noteId,
      title,
      vaultPath,
      relativePath,
      content,
      frontmatter,
      folderConfig,
      vpsConfig,
    } = note;

    // Provide default routing info (must be replaced with actual logic as needed)
    const routing: NoteRoutingInfo = {
      slug: '',
      path: '',
      fullPath: note.vaultPath,
      routeBase: note.folderConfig.routeBase || '',
    };

    const eligibility: NoteEligibility = { isPublishable: false };

    const publishedAt = new Date();

    return {
      noteId,
      title,
      vaultPath,
      relativePath,
      content,
      frontmatter,
      folderConfig,
      vpsConfig,
      routing,
      publishedAt,
      eligibility,
    };
  }
}
