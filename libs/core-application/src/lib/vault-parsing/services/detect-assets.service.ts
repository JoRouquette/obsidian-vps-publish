import { BaseService } from '../../common/base-service';
import { PublishableNote } from '@core-domain/entities';
import { AssetAlignment } from '@core-domain/entities/asset-alignment';
import { AssetDisplayOptions } from '@core-domain/entities/asset-display-options';
import { AssetKind } from '@core-domain/entities/asset-kind';
import { AssetRef } from '@core-domain/entities/asset-ref';
import type { LoggerPort } from '@core-domain/ports/logger-port';

/**
 * Regex pour capturer les embeds Obsidian : ![[...]]
 * - groupe 1 = contenu interne sans les crochets.
 */
const EMBED_REGEX = /!\[\[([^\]]+)\]\]/g;

export class DetectAssetsService implements BaseService {
  private readonly _logger: LoggerPort;

  constructor(logger: LoggerPort) {
    this._logger = logger.child({ usecase: 'DetectAssetsUseCase' });
  }

  process(notes: PublishableNote[]): PublishableNote[] {
    return notes.map((note) => {
      const markdown = note.content;
      const assets: AssetRef[] = [];

      let match: RegExpExecArray | null;
      let embedCount = 0;
      while ((match = EMBED_REGEX.exec(markdown)) !== null) {
        embedCount++;
        const raw = match[0]; // "![[...]]"
        const inner = match[1].trim(); // contenu interne

        if (!inner) {
          this._logger.debug(`Skipped empty embed at match #${embedCount}`);
          continue;
        }

        const segments = inner
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean);
        if (segments.length === 0) {
          this._logger.debug(`Skipped embed with no segments at match #${embedCount}: "${raw}"`);
          continue;
        }

        const target = segments[0]; // ex: "Tenebra1.jpg"
        const modifierTokens = segments.slice(1);

        const kind = this.classifyAssetKind(target);
        const display = this.parseModifiers(modifierTokens, this._logger);

        if (kind === 'other' && !target.includes('.')) {
          this._logger.debug(`Skipped non-asset embed: "${target}" at match #${embedCount}`);
          continue;
        }

        this._logger.debug(
          `Detected asset: target="${target}", kind="${kind}", display=${JSON.stringify(display)}`
        );

        assets.push({
          raw,
          target,
          kind,
          display,
        });
      }

      if (assets.length === 0) {
        this._logger.info(`No assets detected in note "${note.title}"`);
        return note;
      }

      this._logger.info(`Detected ${assets.length} asset(s) in note "${note.title}"`);

      return {
        ...note,
        assets: assets,
      };
    });
  }

  private classifyAssetKind(target: string): AssetKind {
    const lower = target.toLowerCase();

    if (lower.match(/\.(png|jpe?g|gif|webp|svg)$/)) return 'image';
    if (lower.match(/\.(mp3|wav|flac|ogg)$/)) return 'audio';
    if (lower.match(/\.(mp4|webm|mkv|mov)$/)) return 'video';
    if (lower.match(/\.pdf$/)) return 'pdf';

    return 'other';
  }

  private parseAlignment(token: string): AssetAlignment | undefined {
    const lower = token.toLowerCase();
    if (lower === 'left') return 'left';
    if (lower === 'right') return 'right';
    if (lower === 'center' || lower === 'centre') return 'center';
    return undefined;
  }

  private parseModifiers(tokens: string[], logger?: LoggerPort): AssetDisplayOptions {
    let alignment: AssetAlignment | undefined;
    let width: number | undefined;
    const classes: string[] = [];
    const rawModifiers: string[] = [];

    for (const raw of tokens) {
      const token = raw.trim();
      if (!token) continue;

      rawModifiers.push(token);

      // Alignement ITS / CSS-like
      if (!alignment) {
        const a = this.parseAlignment(token);
        if (a) {
          alignment = a;
          logger?.debug(`Parsed alignment modifier: ${a}`);
          continue;
        }
      }

      // Largeur en pixels : "300"
      if (!width && /^[0-9]+$/.test(token)) {
        width = parseInt(token, 10);
        logger?.debug(`Parsed width modifier: ${width}`);
        continue;
      }

      // Le reste : on le traite comme classe CSS / ITS
      classes.push(token);
      logger?.debug(`Parsed class modifier: ${token}`);
    }

    return {
      alignment,
      width,
      classes,
      rawModifiers,
    };
  }
}
