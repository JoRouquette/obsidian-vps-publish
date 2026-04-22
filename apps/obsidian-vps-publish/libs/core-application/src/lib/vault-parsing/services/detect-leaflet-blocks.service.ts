import type {
  LeafletBlock,
  LeafletImageOverlay,
  LeafletMarker,
  LeafletTileServer,
  LoggerPort,
  PublishableNote,
} from '@core-domain';

import { type BaseService } from '../../common/base-service';

/**
 * Regex pour détecter les blocs de code ```leaflet
 * Capture le contenu entre les backticks
 */
const LEAFLET_BLOCK_REGEX = /```leaflet[^\S\r\n]*\r?\n([\s\S]*?)\r?\n```[^\S\r\n]*/g;

/**
 * Service de détection et parsing des blocs Leaflet dans les notes.
 *
 * Ce service doit s'exécuter AVANT ContentSanitizerService pour éviter
 * que les blocs leaflet ne soient tronqués ou modifiés.
 *
 * Basé sur la documentation officielle d'Obsidian Leaflet plugin (javalent/obsidian-leaflet).
 * Supporte deux syntaxes :
 * 1. Clé: valeur simple (ex: `id: my-map`)
 * 2. YAML avec listes (ex: `marker: - [type, lat, long, link]`)
 */
export class DetectLeafletBlocksService implements BaseService {
  private readonly _logger: LoggerPort;

  constructor(logger: LoggerPort) {
    this._logger = logger.child({ scope: 'vault-parsing', operation: 'detectLeafletBlocks' });
  }

  process(notes: PublishableNote[]): PublishableNote[] {
    const startTime = Date.now();
    let totalBlocks = 0;
    let notesWithBlocks = 0;

    const result = notes.map((note) => {
      const blocks: LeafletBlock[] = [];

      // Remplacer les blocs Leaflet valides par des placeholders HTML
      // et conserver les blocs invalides tels quels dans le contenu.
      let blockIndex = 0;
      LEAFLET_BLOCK_REGEX.lastIndex = 0;
      const processedContent = note.content.replace(LEAFLET_BLOCK_REGEX, (fullMatch, rawBlock) => {
        blockIndex++;
        const rawContent = String(rawBlock).trim();

        try {
          const block = this.parseLeafletBlock(rawContent);
          blocks.push(block);
          return `<div class="leaflet-map-placeholder" data-leaflet-map-id="${block.id}"></div>`;
        } catch (error) {
          this._logger.warn('Failed to parse Leaflet block', {
            blockIndex,
            rawContent,
            error: error instanceof Error ? error.message : String(error),
          });
          return fullMatch;
        }
      });

      if (blocks.length === 0) {
        return note;
      }

      totalBlocks += blocks.length;
      notesWithBlocks++;

      // Log details for each note with Leaflet blocks
      this._logger.info('Leaflet blocks found in note', {
        noteVaultPath: note.vaultPath,
        blocksCount: blocks.length,
        blockIds: blocks.map((b) => b.id),
        imageOverlaysCount: blocks.reduce((sum, b) => sum + (b.imageOverlays?.length ?? 0), 0),
        imageOverlayPaths: blocks.flatMap((b) => b.imageOverlays?.map((o) => o.path) ?? []),
      });

      return {
        ...note,
        content: processedContent,
        leafletBlocks: blocks,
      };
    });

    this._logger.info('Leaflet block detection complete', {
      notesProcessed: notes.length,
      notesWithBlocks,
      totalBlocks,
      durationMs: Date.now() - startTime,
    });

    return result;
  }

  /**
   * Parse le contenu brut d'un bloc leaflet.
   * Supporte les formats clé:valeur et YAML.
   */
  private parseLeafletBlock(rawContent: string): LeafletBlock {
    const lines = rawContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const block: Partial<LeafletBlock> = {
      rawContent,
    };

    const markers: LeafletMarker[] = [];
    const imageOverlays: LeafletImageOverlay[] = [];

    for (const line of lines) {
      if (line.startsWith('#')) {
        continue; // Ignore empty lines and comments
      }

      // Détection des lignes au format "clé: valeur"
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) {
        continue;
      }

      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();

      this.parseLeafletProperty(key, value, block, markers, imageOverlays);
    }

    if (markers.length > 0) {
      block.markers = markers;
    }

    if (imageOverlays.length > 0) {
      block.imageOverlays = imageOverlays;
    }

    // Validation : l'id est obligatoire
    if (!block.id) {
      throw new Error('Leaflet block must have an "id" property');
    }

    return block as LeafletBlock;
  }

  /**
   * Parse une propriété individuelle du bloc Leaflet
   */
  private parseLeafletProperty(
    key: string,
    value: string,
    block: Partial<LeafletBlock>,
    markers: LeafletMarker[],
    imageOverlays: LeafletImageOverlay[]
  ): void {
    switch (key.toLowerCase()) {
      case 'id':
        block.id = value;
        break;

      case 'height':
        block.height = value;
        break;

      case 'width':
        block.width = value;
        break;

      case 'lat':
        block.lat = this.parseNumber(value);
        break;

      case 'long':
      case 'lon':
        block.long = this.parseNumber(value);
        break;

      case 'minzoom':
        block.minZoom = this.parseNumber(value);
        break;

      case 'maxzoom':
        block.maxZoom = this.parseNumber(value);
        break;

      case 'defaultzoom':
        block.defaultZoom = this.parseNumber(value);
        break;

      case 'zoomdelta':
        block.zoomDelta = this.parseNumber(value);
        break;

      case 'unit':
        block.unit = value;
        break;

      case 'scale':
        block.scale = this.parseNumber(value);
        break;

      case 'darkmode':
        block.darkMode = this.parseBoolean(value);
        break;

      case 'noscrollzoom':
        block.noScrollZoom = this.parseBoolean(value);
        break;

      case 'lock':
        block.lock = this.parseBoolean(value);
        break;

      case 'image':
        // Peut être une seule image ou une liste
        this.parseImageOverlays(value, imageOverlays);
        break;

      case 'marker':
        // Format: type, lat, long, [link]
        this.parseMarker(value, markers);
        break;

      case 'tileserver':
        block.tileServer = this.parseTileServer(value);
        break;

      default:
        this._logger.debug('Unknown Leaflet property', { key, value });
    }
  }

  /**
   * Parse un nombre depuis une chaîne
   */
  private parseNumber(value: string): number {
    const num = Number.parseFloat(value);
    if (Number.isNaN(num)) {
      throw new TypeError(`Invalid number: ${value}`);
    }
    return num;
  }

  /**
   * Parse un booléen depuis une chaîne
   */
  private parseBoolean(value: string): boolean {
    const lower = value.toLowerCase();
    return lower === 'true' || lower === '1' || lower === 'yes';
  }

  /**
   * Parse les images overlays.
   * Supporte:
   * - Simple: [[image.png]]
   * - Liste YAML: [[image1.png]], [[image2.png]]
   */
  private parseImageOverlays(value: string, overlays: LeafletImageOverlay[]): void {
    // Extraire tous les wikilinks [[...]]
    const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
    let match: RegExpExecArray | null;

    while ((match = wikilinkRegex.exec(value)) !== null) {
      const imagePath = match[1].trim();

      // Pour l'instant, on crée un overlay basique
      // Les coordonnées seront gérées plus tard si spécifiées
      overlays.push({
        path: imagePath,
        topLeft: [0, 0],
        bottomRight: [0, 0],
      });
    }
  }

  /**
   * Parse un marqueur.
   * Format attendu: type, lat, long, [[link]] (optionnel)
   * Exemple: default, 50.5, 30.5, [[My Note]]
   */
  private parseMarker(value: string, markers: LeafletMarker[]): void {
    const normalizedValue = this.normalizeMarkerValue(value);
    if (!normalizedValue) {
      this._logger.warn('Invalid marker format (empty marker value)', { value });
      return;
    }

    // Extraire le wikilink s'il existe
    const wikilinkRegex = /\[\[([^\]]+)\]\]/;
    const wikilinkMatch = wikilinkRegex.exec(normalizedValue);
    const link = wikilinkMatch ? wikilinkMatch[1].trim() : undefined;

    // Retirer le wikilink pour parser le reste
    const valueWithoutLink = normalizedValue.replaceAll(/\[\[[^\]]+\]\]/g, '').trim();

    // Split par virgule
    const parts = valueWithoutLink
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (parts.length < 3) {
      this._logger.warn('Invalid marker format (need at least type, lat, long)', { value });
      return;
    }

    const [type, latStr, longStr, ...rest] = parts;

    try {
      const extraValue = rest.join(',').trim();
      const marker: LeafletMarker = {
        type: type || 'default',
        lat: this.parseNumber(latStr),
        long: this.parseNumber(longStr),
        link: link ?? (/^https?:\/\//i.test(extraValue) ? extraValue : undefined),
      };

      if (extraValue && !marker.link) {
        marker.description = extraValue;
      }

      markers.push(marker);
    } catch (error) {
      this._logger.warn('Failed to parse marker coordinates', {
        value,
        normalizedValue,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private normalizeMarkerValue(value: string): string {
    let normalized = value.trim();

    // Tolère les notations YAML de liste en ligne:
    // marker: - default, 48.8, 2.3
    // marker: - [default, 48.8, 2.3, [[Note]]]
    if (normalized.startsWith('-')) {
      normalized = normalized.substring(1).trim();
    }

    if (normalized.startsWith('[') && normalized.endsWith(']')) {
      normalized = normalized.substring(1, normalized.length - 1).trim();
    }

    return normalized;
  }

  /**
   * Parse la configuration d'un serveur de tuiles.
   * Format simplifié pour l'instant: URL du serveur
   */
  private parseTileServer(value: string): LeafletTileServer {
    return {
      url: value.trim(),
    };
  }
}
