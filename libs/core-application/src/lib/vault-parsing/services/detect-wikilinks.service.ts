import { type PublishableNote } from '@core-domain/entities';
import type { WikilinkKind, WikilinkRef } from '@core-domain/entities/wikilink-ref';
import type { LoggerPort } from '@core-domain/ports/logger-port';

import { type BaseService } from '../../common/base-service';
import { extractFrontmatterStrings } from '../utils/frontmatter-strings.util';

/**
 * Regex to capture wikilinks [[...]].
 * Asset embeds are filtered out by checking the preceding "!".
 */
const WIKILINK_REGEX = /\[\[([^\]]+)\]\]/g;

/**
 * Regex to capture markdown links to .md files [text](file.md) or [text](file.md#section).
 * These are treated as wikilinks for resolution purposes.
 */
const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)]+\.md(?:#[^)]*)?)\)/gi;

type WikilinkOrigin = 'content' | 'frontmatter';

export class DetectWikilinksService implements BaseService {
  private readonly _logger: LoggerPort;

  constructor(logger: LoggerPort) {
    this._logger = logger.child({ scope: 'vault-parsing', operation: 'detectWikilinks' });
  }

  process(note: PublishableNote): WikilinkRef[] {
    const wikilinks: WikilinkRef[] = [];

    this._logger.debug('Starting wikilink detection for note', {
      noteId: note.noteId,
    });

    const fromContent = this.detectInText(note.content, 'content');
    wikilinks.push(...fromContent);

    const fromMarkdownLinks = this.detectMarkdownLinks(note.content, 'content');
    wikilinks.push(...fromMarkdownLinks);

    const frontmatter = note.frontmatter?.nested;
    if (frontmatter && typeof frontmatter === 'object') {
      const strings = extractFrontmatterStrings(frontmatter);
      for (const entry of strings) {
        const detected = this.detectInText(entry.value, 'frontmatter', entry.path);
        wikilinks.push(...detected);

        const markdownLinks = this.detectMarkdownLinks(entry.value, 'frontmatter', entry.path);
        wikilinks.push(...markdownLinks);
      }
    }

    if (wikilinks.length === 0) {
      this._logger.debug('No wikilinks detected in note', {
        noteId: note.noteId,
      });
      return [];
    }

    this._logger.debug('Detected wikilinks in note', {
      noteId: note.noteId,
      count: wikilinks.length,
    });

    return wikilinks;
  }

  private inferKind(path: string): WikilinkKind {
    const lower = path.toLowerCase();

    if (
      lower.match(/\.(png|jpe?g|gif|webp|svg|mp3|wav|flac|ogg|mp4|webm|mkv|mov|pdf|md|markdown)$/)
    ) {
      return 'file';
    }

    return 'note';
  }

  private splitOnce(input: string, separator: string): [string, string | undefined] {
    const index = input.indexOf(separator);
    if (index === -1) return [input, undefined];
    return [input.slice(0, index), input.slice(index + separator.length)];
  }

  private detectInText(
    markdown: string,
    origin: WikilinkOrigin,
    frontmatterPath?: string
  ): WikilinkRef[] {
    const wikilinks: WikilinkRef[] = [];
    WIKILINK_REGEX.lastIndex = 0;

    let match: RegExpExecArray | null;
    let matchesFound = 0;
    let skippedEmpty = 0;
    let skippedAssetEmbed = 0;
    let skippedEmptyTarget = 0;
    let skippedEmptyPath = 0;

    while ((match = WIKILINK_REGEX.exec(markdown)) !== null) {
      matchesFound++;
      const fullMatch = match[0]; // "[[...]]"
      const inner = match[1].trim();
      if (!inner) {
        skippedEmpty++;
        continue;
      }

      const startIndex = match.index ?? 0;
      // Exclude "![[...]]" (assets) by checking previous character
      if (startIndex > 0 && markdown[startIndex - 1] === '!') {
        skippedAssetEmbed++;
        continue;
      }

      const [targetPart, aliasPart] = this.splitOnce(inner, '|');
      const targetRaw = targetPart.trim();
      const alias = aliasPart && aliasPart.trim().length > 0 ? aliasPart.trim() : undefined;

      if (!targetRaw) {
        skippedEmptyTarget++;
        continue;
      }

      const [pathPart, subpathPart] = this.splitOnce(targetRaw, '#');
      const path = pathPart.trim();
      const subpath = subpathPart && subpathPart.trim().length > 0 ? subpathPart.trim() : undefined;

      if (!path) {
        skippedEmptyPath++;
        continue;
      }

      const kind = this.inferKind(path);

      const wikilink: WikilinkRef = {
        origin,
        frontmatterPath,
        raw: fullMatch,
        target: targetRaw,
        path,
        subpath,
        alias,
        kind,
      };

      wikilinks.push(wikilink);
    }

    if (matchesFound > 0) {
      this._logger.debug('Detected wikilinks in text', {
        origin,
        frontmatterPath,
        matchesFound,
        wikilinksDetected: wikilinks.length,
        skipped: {
          empty: skippedEmpty,
          assetEmbed: skippedAssetEmbed,
          emptyTarget: skippedEmptyTarget,
          emptyPath: skippedEmptyPath,
        },
      });
    }

    return wikilinks;
  }

  /**
   * Detect markdown links to .md files and convert them to wikilink references.
   * Supports:
   * - [text](file.md)
   * - [text](path/to/file.md)
   * - [text](file.md#section)
   */
  private detectMarkdownLinks(
    markdown: string,
    origin: WikilinkOrigin,
    frontmatterPath?: string
  ): WikilinkRef[] {
    const wikilinks: WikilinkRef[] = [];
    MARKDOWN_LINK_REGEX.lastIndex = 0;

    let match: RegExpExecArray | null;
    let matchesFound = 0;
    let skippedExternal = 0;

    while ((match = MARKDOWN_LINK_REGEX.exec(markdown)) !== null) {
      matchesFound++;
      const fullMatch = match[0]; // "[text](file.md)"
      const alias = match[1].trim();
      const href = match[2].trim(); // "file.md" or "file.md#section"

      // Skip external URLs (http://, https://, etc.)
      if (/^https?:\/\//i.test(href)) {
        skippedExternal++;
        continue;
      }

      // Remove .md extension and parse subpath
      const hrefWithoutExt = href.replace(/\.md$/i, '');
      const [pathPart, subpathPart] = this.splitOnce(hrefWithoutExt, '#');
      const path = pathPart.trim();
      const subpath = subpathPart && subpathPart.trim().length > 0 ? subpathPart.trim() : undefined;

      if (!path) {
        continue;
      }

      const kind = this.inferKind(path);

      const wikilink: WikilinkRef = {
        origin,
        frontmatterPath,
        raw: fullMatch,
        target: path + (subpath ? `#${subpath}` : ''),
        path,
        subpath,
        alias,
        kind,
      };

      wikilinks.push(wikilink);
    }

    if (matchesFound > 0) {
      this._logger.debug('Detected markdown links to .md files', {
        origin,
        frontmatterPath,
        matchesFound,
        wikilinksCreated: wikilinks.length,
        skipped: {
          external: skippedExternal,
        },
      });
    }

    return wikilinks;
  }
}
