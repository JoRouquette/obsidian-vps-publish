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
      // Extract markdown wikilinks (Dataview already converted to markdown wikilinks by plugin)
      const markdownLinks: WikilinkRef[] = this.detectWikilinksService.process(note);

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
        const targetNote = this.findTargetNote(wikilink.path, lookup);
        const targetPath = targetNote?.routing?.fullPath;
        // A link is only resolved if the target note exists AND has routing defined (will be published)
        // fullPath can be an empty string for root-level notes, so check routing existence instead
        const isResolved = !!targetNote && targetNote.routing !== undefined;
        const targetNoteId = targetNote?.noteId;
        const href =
          targetPath && wikilink.subpath
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

  /**
   * Merge and deduplicate wikilinks from markdown and Dataview HTML.
   *
   * Deduplication strategy:
   * - Normalize paths (lowercase, strip .md, normalize accents)
   * - Keep first occurrence (markdown links take precedence over Dataview)
   * - Preserve all metadata from first occurrence
   *
   * @param markdownLinks - Links extracted from markdown wikilink syntax
   * @param dataviewLinks - Links extracted from Dataview HTML data-wikilink attributes
   * @returns Merged and deduplicated array
   */
  private mergeAndDeduplicateLinks(
    markdownLinks: WikilinkRef[],
    dataviewLinks: WikilinkRef[]
  ): WikilinkRef[] {
    const seen = new Set<string>();
    const merged: WikilinkRef[] = [];

    // Process markdown links first (they take precedence)
    for (const link of markdownLinks) {
      const key = this.getLinkDeduplicationKey(link);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(link);
      }
    }

    // Add Dataview links that weren't already present in markdown
    for (const link of dataviewLinks) {
      const key = this.getLinkDeduplicationKey(link);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(link);
      }
    }

    return merged;
  }

  /**
   * Generate deduplication key for a wikilink.
   * Uses origin + frontmatterPath + normalized target path + subpath (if any).
   *
   * Origin and frontmatterPath are included to avoid deduplicating links
   * that appear in both content and frontmatter, as they serve different purposes.
   *
   * Examples:
   * - [[Folder/Note]] in content → "content::folder/note"
   * - [[Folder/Note]] in frontmatter → "frontmatter:links[0]:folder/note"
   * - [[Folder/Note#Section]] → "content::folder/note#section"
   * - [[Note|Alias]] → "content::note" (alias ignored)
   */
  private getLinkDeduplicationKey(link: WikilinkRef): string {
    const normalizedPath = this.normalizePath(link.path);
    const normalizedSubpath = link.subpath ? `#${link.subpath.toLowerCase()}` : '';
    const origin = link.origin || 'content';
    const fmPath = link.frontmatterPath || '';
    return `${origin}:${fmPath}:${normalizedPath}${normalizedSubpath}`;
  }
}
