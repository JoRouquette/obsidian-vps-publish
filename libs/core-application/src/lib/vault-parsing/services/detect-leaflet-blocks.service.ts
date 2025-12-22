import type { LeafletBlock } from '@core-domain/entities/leaflet-block';
import type { LeafletImageOverlay } from '@core-domain/entities/leaflet-image-overlay';
import type { LeafletMarker } from '@core-domain/entities/leaflet-marker';
import type { LeafletTileServer } from '@core-domain/entities/leaflet-tile-server';
import type { PublishableNote } from '@core-domain/entities/publishable-note';
import type { LoggerPort } from '@core-domain/ports/logger-port';

import { type BaseService } from '../../common/base-service';

/**
 * Regex pour détecter les blocs de code ```leaflet
 * Capture le contenu entre les backticks
 */
const LEAFLET_BLOCK_REGEX = /```leaflet\n([\s\S]*?)```/g;

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
      const blocks = this.extractLeafletBlocks(note.content);

      if (blocks.length === 0) {
        return note;
      }

      totalBlocks += blocks.length;
      notesWithBlocks++;

      // Remplacer les blocs Leaflet par des placeholders HTML
      // Cela permet au frontend Angular d'injecter dynamiquement le composant
      let processedContent = note.content;
      let blockIndex = 0;

      // Réinitialiser la regex pour relire depuis le début
      LEAFLET_BLOCK_REGEX.lastIndex = 0;

      processedContent = processedContent.replace(LEAFLET_BLOCK_REGEX, () => {
        const block = blocks[blockIndex];
        blockIndex++;
        // Générer un placeholder HTML avec l'ID du bloc
        return `<div class="leaflet-map-placeholder" data-leaflet-map-id="${block.id}"></div>`;
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
   * Extrait tous les blocs ```leaflet d'un contenu markdown
   */
  private extractLeafletBlocks(content: string): LeafletBlock[] {
    const blocks: LeafletBlock[] = [];
    let match: RegExpExecArray | null;

    // Reset regex state
    LEAFLET_BLOCK_REGEX.lastIndex = 0;

    while ((match = LEAFLET_BLOCK_REGEX.exec(content)) !== null) {
      const rawContent = match[1].trim();

      try {
        const block = this.parseLeafletBlock(rawContent);
        blocks.push(block);
      } catch (error) {
        this._logger.warn('Failed to parse Leaflet block', {
          rawContent,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return blocks;
  }

  /**
   * Parse le contenu brut d'un bloc leaflet.
   * Supporte les formats clé:valeur et YAML.
   */
  private parseLeafletBlock(rawContent: string): LeafletBlock {
    const lines = rawContent.split('\n').map((line) => line.trim());
    const block: Partial<LeafletBlock> = {
      rawContent,
    };

    const markers: LeafletMarker[] = [];
    const imageOverlays: LeafletImageOverlay[] = [];

    for (const line of lines) {
      if (!line || line.startsWith('#')) {
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
      // Calculer les bounds des images si scale est défini
      this.calculateImageOverlayBounds(imageOverlays, block);
      block.imageOverlays = imageOverlays;
    }

    // Validation : l'id est obligatoire
    if (!block.id) {
      throw new Error('Leaflet block must have an "id" property');
    }

    // Si pas de lat/long mais image avec scale, centrer sur l'image
    if (!block.lat && !block.long && imageOverlays.length > 0 && block.scale) {
      const firstOverlay = imageOverlays[0];
      block.lat = (firstOverlay.topLeft[0] + firstOverlay.bottomRight[0]) / 2;
      block.long = (firstOverlay.topLeft[1] + firstOverlay.bottomRight[1]) / 2;
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

      case 'unit':
        block.unit = value;
        break;

      case 'scale':
        block.scale = this.parseNumber(value);
        break;

      case 'darkmode':
        block.darkMode = this.parseBoolean(value);
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
    const num = parseFloat(value);
    if (isNaN(num)) {
      throw new Error(`Invalid number: ${value}`);
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
    // Extraire le wikilink s'il existe
    const wikilinkMatch = value.match(/\[\[([^\]]+)\]\]/);
    const link = wikilinkMatch ? wikilinkMatch[1].trim() : undefined;

    // Retirer le wikilink pour parser le reste
    const valueWithoutLink = value.replace(/\[\[[^\]]+\]\]/g, '').trim();

    // Split par virgule
    const parts = valueWithoutLink.split(',').map((p) => p.trim());

    if (parts.length < 3) {
      this._logger.warn('Invalid marker format (need at least type, lat, long)', { value });
      return;
    }

    const [type, latStr, longStr, ...rest] = parts;

    try {
      const marker: LeafletMarker = {
        type: type || 'default',
        lat: this.parseNumber(latStr),
        long: this.parseNumber(longStr),
        link,
      };

      // Description éventuelle (après les 3 premiers paramètres)
      if (rest.length > 0 && !link) {
        marker.description = rest.join(',').trim();
      }

      markers.push(marker);
    } catch (error) {
      this._logger.warn('Failed to parse marker coordinates', {
        value,
        error: error instanceof Error ? error.message : String(error),
      });
    }
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

  /**
   * Calcule les bounds des images overlays à partir de la propriété scale.
   * Le scale représente la largeur de l'image en pixels.
   * On crée un ratio 16:9 par défaut pour la hauteur.
   */
  private calculateImageOverlayBounds(
    overlays: LeafletImageOverlay[],
    block: Partial<LeafletBlock>
  ): void {
    if (!block.scale || overlays.length === 0) {
      return;
    }

    // Avec scale, on définit une carte centrée à [0, 0] avec l'image en overlay
    // Le scale représente la largeur en pixels, on convertit en coordonnées Leaflet
    // Leaflet utilise des coordonnées géographiques, donc on crée un système arbitraire
    const scaleWidth = block.scale;
    const scaleHeight = scaleWidth * 0.75; // Ratio 4:3 par défaut

    // Centrer l'image à [0, 0]
    const halfWidth = scaleWidth / 2;
    const halfHeight = scaleHeight / 2;

    overlays.forEach((overlay) => {
      // Les coordonnées Leaflet pour une image overlay : [lat, lng]
      // On utilise un système de coordonnées "pixel" centré sur [0, 0]
      overlay.topLeft = [halfHeight, -halfWidth];
      overlay.bottomRight = [-halfHeight, halfWidth];
    });

    this._logger.debug('Calculated image overlay bounds from scale', {
      scale: block.scale,
      bounds: {
        topLeft: overlays[0].topLeft,
        bottomRight: overlays[0].bottomRight,
      },
    });
  }
}
