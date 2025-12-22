import { type PublishableNote } from '@core-domain/entities';
import { type AssetAlignment } from '@core-domain/entities/asset-alignment';
import { type AssetDisplayOptions } from '@core-domain/entities/asset-display-options';
import { type AssetKind } from '@core-domain/entities/asset-kind';
import { type AssetRef } from '@core-domain/entities/asset-ref';
import type { LoggerPort } from '@core-domain/ports/logger-port';

import { type BaseService } from '../../common/base-service';
import { extractFrontmatterStrings } from '../utils/frontmatter-strings.util';

/**
 * Regex pour capturer les embeds Obsidian : ![[...]]
 * - groupe 1 = contenu interne sans les crochets.
 */
const EMBED_REGEX = /!\[\[([^\]]+)\]\]/g;
type AssetOrigin = 'content' | 'frontmatter';

export class DetectAssetsService implements BaseService {
  private readonly _logger: LoggerPort;

  constructor(logger: LoggerPort) {
    this._logger = logger.child({ scope: 'vault-parsing', operation: 'detectAssets' });
  }

  process(notes: PublishableNote[]): PublishableNote[] {
    const startTime = Date.now();
    let totalAssets = 0;
    let notesWithAssets = 0;

    const result = notes.map((note) => {
      const contentAssets = this.detectInText(note.content, 'content');
      const frontmatterAssets = this.detectInFrontmatter(note);
      const leafletAssets = this.detectInLeafletBlocks(note);
      const assets = [...contentAssets, ...frontmatterAssets, ...leafletAssets];

      if (assets.length > 0) {
        totalAssets += assets.length;
        notesWithAssets++;
      }

      return {
        ...note,
        assets: assets,
      };
    });

    this._logger.info('Asset detection complete', {
      notesProcessed: notes.length,
      notesWithAssets,
      totalAssets,
      durationMs: Date.now() - startTime,
    });

    return result;
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

  private detectInFrontmatter(note: PublishableNote): AssetRef[] {
    if (!note.frontmatter?.nested || typeof note.frontmatter.nested !== 'object') {
      return [];
    }

    const entries = extractFrontmatterStrings(note.frontmatter.nested);
    const assets: AssetRef[] = [];

    for (const entry of entries) {
      const found = this.detectInText(entry.value, 'frontmatter', entry.path);
      assets.push(...found);
    }

    return assets;
  }

  private detectInText(
    markdown: string,
    origin: AssetOrigin,
    frontmatterPath?: string
  ): AssetRef[] {
    const assets: AssetRef[] = [];
    EMBED_REGEX.lastIndex = 0;

    let match: RegExpExecArray | null;
    let embedCount = 0;
    let skippedEmpty = 0;
    let skippedNoSegments = 0;
    let skippedNonAsset = 0;

    while ((match = EMBED_REGEX.exec(markdown)) !== null) {
      embedCount++;
      const raw = match[0]; // "![[...]]"
      const inner = match[1].trim(); // contenu interne

      if (!inner) {
        skippedEmpty++;
        continue;
      }

      const segments = inner
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);
      if (segments.length === 0) {
        skippedNoSegments++;
        continue;
      }

      const target = this.normalizeTarget(segments[0]); // ex: "Tenebra1.jpg"
      const modifierTokens = segments.slice(1);

      const kind = this.classifyAssetKind(target);
      const display = this.parseModifiers(modifierTokens);

      if (kind === 'other' && !target.includes('.')) {
        skippedNonAsset++;
        continue;
      }

      assets.push({
        origin,
        frontmatterPath,
        raw,
        target,
        kind,
        display,
      });
    }

    if (embedCount > 0) {
      this._logger.debug('Detected assets in text', {
        origin,
        frontmatterPath,
        embedsFound: embedCount,
        assetsDetected: assets.length,
        skipped: {
          empty: skippedEmpty,
          noSegments: skippedNoSegments,
          nonAsset: skippedNonAsset,
        },
      });
    }

    return assets;
  }

  private parseModifiers(tokens: string[]): AssetDisplayOptions {
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
          continue;
        }
      }

      // Largeur en pixels : "300"
      if (!width && /^[0-9]+$/.test(token)) {
        width = parseInt(token, 10);
        continue;
      }

      // Le reste : on le traite comme classe CSS / ITS
      classes.push(token);
    }

    return {
      alignment,
      width,
      classes,
      rawModifiers,
    };
  }

  private normalizeTarget(target: string): string {
    if (!target) return '';
    let t = target.trim().replace(/\\/g, '/');
    t = t.replace(/^\.\/+/, '');
    t = t.replace(/^\/+/, '');
    return t;
  }

  /**
   * Détecte les assets dans les blocs Leaflet (imageOverlays)
   */
  private detectInLeafletBlocks(note: PublishableNote): AssetRef[] {
    if (!note.leafletBlocks || note.leafletBlocks.length === 0) {
      return [];
    }

    const assets: AssetRef[] = [];
    let skippedEmpty = 0;

    for (const block of note.leafletBlocks) {
      if (!block.imageOverlays || block.imageOverlays.length === 0) {
        continue;
      }

      for (const overlay of block.imageOverlays) {
        const target = this.normalizeTarget(overlay.path);

        if (!target) {
          skippedEmpty++;
          continue;
        }

        const kind = this.classifyAssetKind(target);

        const asset: AssetRef = {
          raw: `[[${overlay.path}]]`,
          target,
          kind,
          origin: 'content', // Considéré comme venant du contenu
          display: {
            alignment: undefined,
            width: undefined,
            classes: [],
            rawModifiers: [],
          },
        };

        assets.push(asset);
      }
    }

    if (note.leafletBlocks.length > 0) {
      this._logger.debug('Detected Leaflet block assets', {
        blocksProcessed: note.leafletBlocks.length,
        assetsDetected: assets.length,
        skippedEmpty,
      });
    }

    return assets;
  }
}
