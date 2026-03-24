import { type LoggerPort, type WikilinkRef } from '@core-domain';
import { type PublishableNote, type ResolvedWikilink } from '@core-domain';

import { type BaseService } from '../../common/base-service';
import {
  getInternalLinkBasename,
  normalizeInternalLinkKey,
  normalizeInternalLinkPath,
  resolveRelativeInternalLinkPath,
} from '../../utils/internal-link-path.util';
import { type DetectWikilinksService } from './detect-wikilinks.service';

interface NoteLookup {
  exactPath: Map<string, PublishableNote[]>;
  slugPath: Map<string, PublishableNote[]>;
  basename: Map<string, PublishableNote[]>;
  basenameSlug: Map<string, PublishableNote[]>;
  titleSlug: Map<string, PublishableNote[]>;
  alias: Map<string, PublishableNote[]>;
  aliasSlug: Map<string, PublishableNote[]>;
}

export class ResolveWikilinksService implements BaseService {
  private readonly _logger: LoggerPort;

  constructor(
    logger: LoggerPort,
    private readonly detectWikilinksService: DetectWikilinksService
  ) {
    this._logger = logger.child({ scope: 'vault-parsing', operation: 'resolveWikilinks' });
  }

  process(notes: PublishableNote[]): PublishableNote[] {
    const startTime = Date.now();
    let totalWikilinks = 0;
    let resolvedCount = 0;
    let unresolvedCount = 0;

    const wikilinksByNotes: Record<string, WikilinkRef[]> = {};
    const lookup = this.buildNoteLookup(notes);

    for (const note of notes) {
      const markdownLinks = this.detectWikilinksService.process(note);

      if (markdownLinks.length === 0) {
        this._logger.debug('No wikilinks found in note', { noteId: note.noteId });
        continue;
      }

      wikilinksByNotes[note.noteId] = markdownLinks;
      totalWikilinks += markdownLinks.length;
    }

    for (const note of notes) {
      const wikilinks = wikilinksByNotes[note.noteId] || [];
      const resolvedWikilinks: ResolvedWikilink[] = wikilinks.map((wikilink) => {
        const targetNote = this.findTargetNoteForWikilink(wikilink, note, lookup);
        const targetPath = targetNote?.routing?.fullPath;
        const isResolved = !!targetNote && targetNote.routing !== undefined;
        const targetNoteId = targetNote?.noteId;
        const href =
          !wikilink.path && wikilink.subpath
            ? `#${wikilink.subpath}`
            : targetPath && wikilink.subpath
              ? `${targetPath}#${wikilink.subpath}`
              : (targetPath ?? undefined);

        if (isResolved) {
          resolvedCount++;
        } else {
          unresolvedCount++;
        }

        return {
          ...wikilink,
          isResolved,
          targetNoteId,
          href,
          path: targetPath ?? wikilink.path,
        };
      });

      note.resolvedWikilinks = resolvedWikilinks;
    }

    this._logger.info('Wikilink resolution complete', {
      notesProcessed: notes.length,
      totalWikilinks,
      resolved: resolvedCount,
      unresolved: unresolvedCount,
      durationMs: Date.now() - startTime,
    });

    return notes;
  }

  private buildNoteLookup(notes: PublishableNote[]): NoteLookup {
    const lookup: NoteLookup = {
      exactPath: new Map<string, PublishableNote[]>(),
      slugPath: new Map<string, PublishableNote[]>(),
      basename: new Map<string, PublishableNote[]>(),
      basenameSlug: new Map<string, PublishableNote[]>(),
      titleSlug: new Map<string, PublishableNote[]>(),
      alias: new Map<string, PublishableNote[]>(),
      aliasSlug: new Map<string, PublishableNote[]>(),
    };

    for (const note of notes) {
      const normalizedPath = this.normalizePath(this.stripExtension(note.relativePath));
      const basename = this.basename(normalizedPath);
      const basenameSlug = this.slugifySegment(basename);
      const slugPath = this.slugifyPath(normalizedPath);
      const titleSlug = this.slugifySegment(note.title);
      const aliases = this.extractAliases(note);

      this.addLookupEntry(lookup.exactPath, normalizedPath, note);
      this.addLookupEntry(lookup.slugPath, slugPath, note);
      this.addLookupEntry(lookup.basename, basename, note);
      this.addLookupEntry(lookup.basenameSlug, basenameSlug, note);
      this.addLookupEntry(lookup.titleSlug, titleSlug, note);
      for (const alias of aliases) {
        this.addLookupEntry(lookup.alias, alias, note);
        this.addLookupEntry(lookup.aliasSlug, this.slugifySegment(alias), note);
      }
    }

    return lookup;
  }

  private addLookupEntry(
    map: Map<string, PublishableNote[]>,
    rawKey: string,
    note: PublishableNote
  ): void {
    const key = this.normalizeKey(rawKey);
    if (!key) {
      return;
    }

    const existing = map.get(key);
    if (existing) {
      existing.push(note);
      return;
    }

    map.set(key, [note]);
  }

  private findTargetNoteForWikilink(
    wikilink: WikilinkRef,
    currentNote: PublishableNote,
    lookup: NoteLookup
  ): PublishableNote | undefined {
    if (!wikilink.path && wikilink.subpath) {
      return currentNote;
    }

    return this.findTargetNote(wikilink.path, currentNote, lookup);
  }

  private findTargetNote(
    target: string,
    currentNote: PublishableNote,
    lookup: NoteLookup
  ): PublishableNote | undefined {
    const normalizedTarget = this.normalizePath(this.stripExtension(target));
    const resolvedRelativeTarget = resolveRelativeInternalLinkPath(
      normalizedTarget,
      currentNote.relativePath
    );
    if (!resolvedRelativeTarget) {
      return undefined;
    }

    const targetHasFolders = resolvedRelativeTarget.includes('/');

    if (!targetHasFolders) {
      const currentFolderTarget = this.joinPaths(
        this.dirname(this.stripExtension(currentNote.relativePath)),
        resolvedRelativeTarget
      );
      const sameFolderMatch = this.getUniqueCandidate(
        [
          ...this.getLookupNotes(lookup.exactPath, currentFolderTarget),
          ...this.getLookupNotes(lookup.slugPath, this.slugifyPath(currentFolderTarget)),
        ],
        target,
        currentNote,
        'same-folder'
      );

      if (sameFolderMatch) {
        return sameFolderMatch;
      }
    }

    const exactMatch = this.getUniqueCandidate(
      [
        ...this.getLookupNotes(lookup.exactPath, resolvedRelativeTarget),
        ...this.getLookupNotes(lookup.slugPath, this.slugifyPath(resolvedRelativeTarget)),
      ],
      target,
      currentNote,
      targetHasFolders ? 'path' : 'exact'
    );

    if (exactMatch || targetHasFolders) {
      return exactMatch;
    }

    return this.getUniqueCandidate(
      [
        ...this.getLookupNotes(lookup.basename, getInternalLinkBasename(resolvedRelativeTarget)),
        ...this.getLookupNotes(lookup.basenameSlug, this.slugifySegment(resolvedRelativeTarget)),
        ...this.getLookupNotes(lookup.titleSlug, this.slugifySegment(resolvedRelativeTarget)),
        ...this.getLookupNotes(lookup.alias, resolvedRelativeTarget),
        ...this.getLookupNotes(lookup.aliasSlug, this.slugifySegment(resolvedRelativeTarget)),
      ],
      target,
      currentNote,
      'basename'
    );
  }

  private getLookupNotes(map: Map<string, PublishableNote[]>, rawKey: string): PublishableNote[] {
    const key = this.normalizeKey(rawKey);
    return key ? (map.get(key) ?? []) : [];
  }

  private getUniqueCandidate(
    candidates: PublishableNote[],
    target: string,
    currentNote: PublishableNote,
    strategy: string
  ): PublishableNote | undefined {
    const unique = Array.from(new Map(candidates.map((note) => [note.noteId, note])).values());
    if (unique.length <= 1) {
      return unique[0];
    }

    this._logger.warn('Ambiguous wikilink target left unresolved', {
      currentNote: currentNote.relativePath,
      target,
      strategy,
      candidatePaths: unique.map((note) => note.relativePath),
    });

    return undefined;
  }

  private normalizePath(path: string): string {
    return normalizeInternalLinkPath(path);
  }

  private dirname(path: string): string {
    const normalized = this.normalizePath(path);
    const lastSlash = normalized.lastIndexOf('/');
    return lastSlash === -1 ? '' : normalized.slice(0, lastSlash);
  }

  private joinPaths(left: string, right: string): string {
    return [left, right].filter(Boolean).join('/');
  }

  private basename(path: string): string {
    return getInternalLinkBasename(path);
  }

  private stripExtension(path: string): string {
    return path.replace(/\.[^/.]+$/, '');
  }

  private normalizeKey(value: string): string {
    return normalizeInternalLinkKey(value);
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

  private extractAliases(note: PublishableNote): string[] {
    const rawAliases = note.frontmatter?.flat?.['aliases'];
    if (typeof rawAliases === 'string') {
      return rawAliases.trim() ? [rawAliases.trim()] : [];
    }

    if (!Array.isArray(rawAliases)) {
      return [];
    }

    return rawAliases
      .filter((alias): alias is string => typeof alias === 'string')
      .map((alias) => alias.trim())
      .filter(Boolean);
  }
}
