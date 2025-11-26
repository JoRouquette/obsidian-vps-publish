import { DomainFrontmatter, LoggerPort } from '@core-domain';
import { PublishableNote } from '@core-domain/entities/publishable-note';
import { SanitizationRules } from '@core-domain/entities/sanitization-rules';

export class ContentSanitizerService implements BaseService {
  constructor(
    private readonly sanitizationRules: SanitizationRules[],
    private readonly frontmatterKeysToExclude?: string[],
    private readonly frontmatterTagsToExclude?: string[],
    private readonly logger?: LoggerPort
  ) {}

  process(notes: PublishableNote[]): PublishableNote[] {
    if (this.frontmatterKeysToExclude) {
      notes = this.sanitizeFrontmatter(notes);
    }

    if (this.frontmatterTagsToExclude?.length) {
      notes = this.sanitizeTags(notes);
    }

    return notes;
  }

  private sanitizeFrontmatter(notes: PublishableNote[]): PublishableNote[] {
    this.logger?.debug('Sanitizing frontmatter for notes', { notesLength: notes.length });

    for (const note of notes) {
      this.logger?.debug('Sanitizing frontmatter for note', { noteId: note.noteId });
      for (const key of this.frontmatterKeysToExclude!) {
        this.logger?.debug('Excluding frontmatter key', { key, noteId: note.noteId });
        delete note.frontmatter.nested[key];
        delete note.frontmatter.flat[key];
      }
    }

    return notes;
  }

  private sanitizeTags(notes: PublishableNote[]): PublishableNote[] {
    const exclude = (this.frontmatterTagsToExclude || []).map((t) => t.toLowerCase());
    if (exclude.length === 0) return notes;

    for (const note of notes) {
      const tags = note.frontmatter.tags || [];
      if (!Array.isArray(tags) || tags.length === 0) continue;
      const filtered = tags.filter(
        (tag) => typeof tag !== 'string' || !exclude.includes(tag.toLowerCase())
      );
      if (filtered.length !== tags.length) {
        this.logger?.debug('Excluding frontmatter tags', {
          noteId: note.noteId,
          removed: tags.filter(
            (tag) => typeof tag === 'string' && exclude.includes(tag.toLowerCase())
          ),
        });
        note.frontmatter.tags = filtered;
      }
    }

    return notes;
  }
}
