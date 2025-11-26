import { LoggerPort, WikilinkRef } from '@core-domain';
import { PublishableNote, ResolvedWikilink } from '@core-domain';
import { DetectWikilinksService } from './detect-wikilinks.service';

export class ResolveWikilinksService implements BaseService {
  private readonly _logger: LoggerPort;

  constructor(
    logger: LoggerPort,
    private readonly detectWikilinksService: DetectWikilinksService
  ) {
    this._logger = logger.child({ usecase: 'ResolveWikilinksUseCase' });
  }

  process(notes: PublishableNote[]): PublishableNote[] {
    this._logger.debug('Resolving wikilinks for notes', { notesLength: notes.length });

    const wikilinksByNotes: Record<string, WikilinkRef[]> = {};
    for (const note of notes) {
      this._logger.debug('Processing note for wikilinks', { note });
      const wikilinks: WikilinkRef[] = this.detectWikilinksService.process(note);

      if (wikilinks.length === 0) {
        this._logger.debug('No wikilinks found in note', { noteId: note.noteId });
        continue;
      }

      wikilinksByNotes[note.noteId] = wikilinks;
    }

    for (const note of notes) {
      const wikilinks = wikilinksByNotes[note.noteId] || [];
      const resolvedWikilinks: ResolvedWikilink[] = wikilinks.map((wikilink) => {
        const targetNote = notes.find((n) => n.relativePath === wikilink.path);
        const isResolved = !!targetNote;
        const targetNoteId = targetNote?.noteId;
        return {
          ...wikilink,
          isResolved,
          targetNoteId,
        };
      });

      note.resolvedWikilinks = resolvedWikilinks;
      this._logger.debug('Resolved wikilinks for note', {
        noteId: note.noteId,
        resolvedWikilinks,
      });
    }

    return notes;
  }
}
