import { PublishableNote } from '@core-domain/entities';
import type { WikilinkKind, WikilinkRef } from '@core-domain/entities/wikilink-ref';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import { BaseService } from '../../common/base-service';
import { extractFrontmatterStrings } from '../utils/frontmatter-strings.util';

/**
 * Regex to capture wikilinks [[...]].
 * Asset embeds are filtered out by checking the preceding "!".
 */
const WIKILINK_REGEX = /\[\[([^\]]+)\]\]/g;
type WikilinkOrigin = 'content' | 'frontmatter';

export class DetectWikilinksService implements BaseService {
  private readonly _logger: LoggerPort;

  constructor(logger: LoggerPort) {
    this._logger = logger.child({ usecase: 'DetectWikilinksUseCase' });
  }

  process(note: PublishableNote): WikilinkRef[] {
    const wikilinks: WikilinkRef[] = [];

    this._logger.debug('Starting wikilink detection for note', {
      noteId: note.noteId,
    });

    const fromContent = this.detectInText(note.content, 'content');
    wikilinks.push(...fromContent);

    const frontmatter = note.frontmatter?.nested;
    if (frontmatter && typeof frontmatter === 'object') {
      const strings = extractFrontmatterStrings(frontmatter);
      for (const entry of strings) {
        const detected = this.detectInText(entry.value, 'frontmatter', entry.path);
        wikilinks.push(...detected);
      }
    }

    if (wikilinks.length === 0) {
      this._logger.info('No wikilinks detected in note', {
        noteId: note.noteId,
      });
      return [];
    }

    this._logger.info('Detected wikilinks in note', {
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

    while ((match = WIKILINK_REGEX.exec(markdown)) !== null) {
      const fullMatch = match[0]; // "[[...]]"
      const inner = match[1].trim();
      if (!inner) {
        this._logger.debug('Skipping empty wikilink match', {
          match: fullMatch,
          index: match.index,
        });
        continue;
      }

      const startIndex = match.index ?? 0;
      // Exclude "![[...]]" (assets) by checking previous character
      if (startIndex > 0 && markdown[startIndex - 1] === '!') {
        this._logger.debug('Skipping asset embed wikilink', {
          match: fullMatch,
          index: startIndex,
        });
        continue;
      }

      const [targetPart, aliasPart] = this.splitOnce(inner, '|');
      const targetRaw = targetPart.trim();
      const alias = aliasPart && aliasPart.trim().length > 0 ? aliasPart.trim() : undefined;

      if (!targetRaw) {
        this._logger.debug('Skipping wikilink with empty target', {
          match: fullMatch,
          index: startIndex,
        });
        continue;
      }

      const [pathPart, subpathPart] = this.splitOnce(targetRaw, '#');
      const path = pathPart.trim();
      const subpath = subpathPart && subpathPart.trim().length > 0 ? subpathPart.trim() : undefined;

      if (!path) {
        this._logger.debug('Skipping wikilink with empty path', {
          match: fullMatch,
          index: startIndex,
        });
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

      this._logger.debug('Detected wikilink', { wikilink, index: startIndex });
      wikilinks.push(wikilink);
    }

    this._logger.debug('Detected wikilinks in text', {
      origin,
      frontmatterPath,
      count: wikilinks.length,
    });

    return wikilinks;
  }
}
