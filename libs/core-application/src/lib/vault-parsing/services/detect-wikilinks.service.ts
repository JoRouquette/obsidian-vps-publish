import { PublishableNote } from '@core-domain/entities';
import type { WikilinkKind, WikilinkRef } from '@core-domain/entities/wikilink-ref';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import { QueryHandler } from '../../common/query-handler';

/**
 * Regex pour capturer les wikilinks [[...]].
 * On filtrera les cas précédés par "!" pour exclure les embeds d'assets.
 */
const WIKILINK_REGEX = /\[\[([^\]]+)\]\]/g;

export class DetectWikilinksService implements BaseService {
  private readonly _logger: LoggerPort;

  constructor(logger: LoggerPort) {
    this._logger = logger.child({ usecase: 'DetectWikilinksUseCase' });
  }

  process(note: PublishableNote): WikilinkRef[] {
    const markdown = note.content;
    const wikilinks: WikilinkRef[] = [];

    let match: RegExpExecArray | null;
    let matchCount = 0;

    this._logger.debug('Starting wikilink detection for note', {
      noteId: note.noteId,
    });

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
      // Exclure les "![[...]]" (assets) en vérifiant le caractère précédent
      if (startIndex > 0 && markdown[startIndex - 1] === '!') {
        this._logger.debug('Skipping asset embed wikilink', {
          match: fullMatch,
          index: startIndex,
        });
        continue;
      }

      // 1) Séparer cible et alias : "cible|alias"
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

      // 2) Séparer path et subpath : "path#subpath"
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
        raw: fullMatch,
        target: targetRaw,
        path,
        subpath,
        alias,
        kind,
      };

      this._logger.debug('Detected wikilink', { wikilink, index: startIndex });
      wikilinks.push(wikilink);
      matchCount++;
    }

    if (wikilinks.length === 0) {
      this._logger.info('No wikilinks detected in note', {
        noteId: note.noteId,
      });
      return [];
    }

    this._logger.info('Detected wikilinks in note', {
      noteId: note.noteId,
      count: matchCount,
    });

    return wikilinks;
  }

  private inferKind(path: string): WikilinkKind {
    const lower = path.toLowerCase();

    // Heuristique très simple : si ça ressemble à un fichier, on marque "file".
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
}
