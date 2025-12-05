import { type LoggerPort, type WikilinkRef } from '@core-domain';
import { type PublishableNote, type ResolvedWikilink } from '@core-domain';

import { type BaseService } from '../../common/base-service';
import { type DetectWikilinksService } from './detect-wikilinks.service';

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
    const lookup = this.buildNoteLookup(notes);

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
        const targetNote = this.findTargetNote(wikilink.path, lookup);
        const isResolved = !!targetNote;
        const targetNoteId = targetNote?.noteId;
        const targetPath = targetNote?.routing?.fullPath || targetNote?.relativePath;
        const href =
          targetPath && wikilink.subpath
            ? `${targetPath}#${wikilink.subpath}`
            : (targetPath ?? undefined);
        return {
          ...wikilink,
          isResolved,
          targetNoteId,
          href,
          path: targetPath ?? wikilink.path,
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

  private buildNoteLookup(notes: PublishableNote[]): Map<string, PublishableNote> {
    const lookup = new Map<string, PublishableNote>();

    for (const note of notes) {
      const keys = this.buildNoteKeys(note);
      for (const key of keys) {
        if (!lookup.has(key)) {
          lookup.set(key, note);
        }
      }
    }

    return lookup;
  }

  private buildNoteKeys(note: PublishableNote): string[] {
    const normalizedPath = this.normalizePath(note.relativePath);
    const fileName = this.basename(normalizedPath);
    const withoutExt = this.stripExtension(normalizedPath);
    const fileWithoutExt = this.stripExtension(fileName);
    const slugPath = this.slugifyPath(withoutExt);
    const slugFile = this.basename(slugPath);
    const titleSlug = this.slugifySegment(note.title);

    return this.normalizeKeys([
      normalizedPath,
      withoutExt,
      fileName,
      fileWithoutExt,
      slugPath,
      slugFile,
      titleSlug,
    ]);
  }

  private buildLinkKeys(target: string): string[] {
    const normalized = this.normalizePath(target);
    const fileName = this.basename(normalized);
    const withoutExt = this.stripExtension(normalized);
    const fileWithoutExt = this.stripExtension(fileName);
    const withMd = normalized.endsWith('.md') ? normalized : `${normalized}.md`;
    const slugPath = this.slugifyPath(withoutExt);
    const slugFile = this.basename(slugPath);

    return this.normalizeKeys([
      normalized,
      withMd,
      withoutExt,
      fileName,
      fileWithoutExt,
      slugPath,
      slugFile,
      this.slugifySegment(target),
    ]);
  }

  private normalizeKeys(keys: string[]): string[] {
    const set = new Set<string>();
    for (const key of keys) {
      const normalized = this.normalizeKey(key);
      if (normalized) {
        set.add(normalized);
      }
    }
    return Array.from(set.values());
  }

  private findTargetNote(target: string, lookup: Map<string, PublishableNote>) {
    const candidates = this.buildLinkKeys(target);
    for (const key of candidates) {
      const note = lookup.get(key);
      if (note) {
        return note;
      }
    }
    return undefined;
  }

  private normalizePath(path: string): string {
    return path
      .replace(/\\/g, '/')
      .replace(/^\/+|\/+$/g, '')
      .trim();
  }

  private basename(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 1] ?? path;
  }

  private stripExtension(path: string): string {
    return path.replace(/\.[^/.]+$/, '');
  }

  private normalizeKey(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';

    return trimmed
      .replace(/\\/g, '/')
      .replace(/^\/+|\/+$/g, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private slugifyPath(path: string): string {
    const normalized = this.normalizePath(path);
    if (!normalized) return '';

    return normalized
      .split('/')
      .filter(Boolean)
      .map((segment) => this.slugifySegment(segment))
      .filter(Boolean)
      .join('/');
  }

  private slugifySegment(segment: string): string {
    return segment
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/\s/g, '-');
  }
}
