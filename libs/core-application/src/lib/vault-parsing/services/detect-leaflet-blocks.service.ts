import type { LeafletBlock } from 'libs/core-domain/src/lib/entities/leaflet-block';
import type { LeafletImageOverlay } from 'libs/core-domain/src/lib/entities/leaflet-image-overlay';
import type { LeafletMarker } from 'libs/core-domain/src/lib/entities/leaflet-marker';
import type { LeafletTileServer } from 'libs/core-domain/src/lib/entities/leaflet-tile-server';
import type { PublishableNote } from 'libs/core-domain/src/lib/entities/publishable-note';

import { type BaseService } from '../../common/base-service';

/**
 * Service to detect and parse Leaflet blocks in note content.
 * Follows the BaseService pattern for processing PublishableNote arrays.
 */
export class DetectLeafletBlocksService implements BaseService {
  private _logger: { debug: Function; warn: Function };

  // Regex to match ```leaflet blocks
  private static readonly LEAFLET_BLOCK_REGEX = /```leaflet\s*\n([\s\S]*?)```/g;

  constructor(logger: { debug: Function; warn: Function }) {
    this._logger = logger;
  }

  /**
   * Process notes to detect and parse Leaflet blocks.
   * Follows BaseService pattern: process(notes: PublishableNote[]): PublishableNote[]
   */
  public process(notes: PublishableNote[]): PublishableNote[] {
    this._logger.debug('Detecting Leaflet blocks in notes', { notesCount: notes.length });

    return notes.map((note) => this.processNote(note));
  }

  /**
   * Process a single note to detect and parse Leaflet blocks.
   */
  private processNote(note: PublishableNote): PublishableNote {
    const leafletBlocks: LeafletBlock[] = [];
    const regex = new RegExp(DetectLeafletBlocksService.LEAFLET_BLOCK_REGEX.source, 'g');

    let match: RegExpExecArray | null;
    while ((match = regex.exec(note.content)) !== null) {
      const rawContent = match[1];
      try {
        const parsedBlock = this.parseLeafletBlock(rawContent);
        leafletBlocks.push(parsedBlock);
      } catch (error) {
        this._logger.warn('Failed to parse Leaflet block', {
          noteId: note.noteId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (leafletBlocks.length > 0) {
      this._logger.debug('Detected Leaflet blocks in note', {
        noteId: note.noteId,
        blocksCount: leafletBlocks.length,
      });
    }

    return {
      ...note,
      leafletBlocks: leafletBlocks.length > 0 ? leafletBlocks : note.leafletBlocks,
    };
  }

  /**
   * Parse a raw Leaflet block content and return a LeafletBlock DTO v1.
   */
  private parseLeafletBlock(rawContent: string): LeafletBlock {
    const block: Partial<LeafletBlock> = {};
    const markers: LeafletMarker[] = [];
    const imageOverlays: LeafletImageOverlay[] = [];
    let type: 'image' | 'tile' = 'tile';
    let imageAssetRef = '';
    let tileServerUrl = '';
    const geojson: Array<{ assetRef: string; style?: Record<string, unknown> }> = [];

    // Parse YAML-like lines
    const lines = rawContent.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
      if (match) {
        const key = match[1];
        const value = match[2];
        this.parseLeafletProperty(key, value, block, markers, imageOverlays);
        if (key.toLowerCase() === 'image') {
          const wikilinkMatch = value.match(/\[\[([^\]]+)\]\]/);
          if (wikilinkMatch) {
            imageAssetRef = wikilinkMatch[1].trim();
          }
        }
        if (key.toLowerCase() === 'tileserver') tileServerUrl = value;
      }
    }

    // Type auto
    type = imageAssetRef ? 'image' : tileServerUrl ? 'tile' : 'tile';

    // Generate deterministic id if absent
    if (!block.id) {
      block.id = this.generateDeterministicId(rawContent);
    }

    // Strict validation
    if (!block.id) throw new Error('Leaflet block must have an "id" property');

    // Build DTO v1
    const dto: LeafletBlock = {
      version: 1,
      id: block.id,
      type,
      lat: block.lat,
      long: block.long,
      height: block.height,
      width: block.width,
      defaultZoom: block.defaultZoom,
      minZoom: block.minZoom,
      maxZoom: block.maxZoom,
      darkMode: block.darkMode,
      unit: block.unit,
      rawContent,
    };

    if (imageAssetRef) {
      dto.image = { assetRef: imageAssetRef };
    }
    if (block.tileServer) {
      dto.tileServer = block.tileServer;
    }
    if (markers.length > 0) {
      dto.markers = markers;
    }
    if (geojson.length > 0) {
      dto.geojson = geojson;
    }
    if (imageOverlays.length > 0) {
      dto.imageOverlays = imageOverlays;
    }

    return dto;
  }

  /**
   * Generate a deterministic ID from content using a simple hash.
   * Browser-compatible (no crypto dependency).
   */
  private generateDeterministicId(content: string): string {
    // Simple DJB2 hash algorithm - fast and deterministic
    let hash = 5381;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) + hash) ^ content.charCodeAt(i);
    }
    // Convert to positive hex string and take first 12 chars
    return (
      (hash >>> 0).toString(16).padStart(8, '0') +
      ((hash >>> 0) ^ content.length).toString(16).padStart(4, '0')
    );
  }

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
      case 'darkmode':
        block.darkMode = this.parseBoolean(value);
        break;
      case 'image':
        this.parseImageOverlays(value, imageOverlays);
        break;
      case 'marker':
        this.parseMarker(value, markers);
        break;
      case 'tileserver':
        block.tileServer = this.parseTileServer(value);
        break;
      default:
        this._logger.debug('Unknown Leaflet property', { key, value });
        break;
    }
  }

  private parseNumber(value: string): number {
    const num = Number.parseFloat(value);
    if (Number.isNaN(num)) {
      throw new TypeError(`Invalid number: ${value}`);
    }
    return num;
  }

  private parseBoolean(value: string): boolean {
    const lower = value.toLowerCase();
    return lower === 'true' || lower === '1' || lower === 'yes';
  }

  private parseImageOverlays(value: string, overlays: LeafletImageOverlay[]): void {
    const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
    let match: RegExpExecArray | null;
    while ((match = wikilinkRegex.exec(value)) !== null) {
      const imagePath = match[1].trim();
      overlays.push({
        path: imagePath,
        topLeft: [0, 0],
        bottomRight: [0, 0],
      });
    }
  }

  private parseMarker(value: string, markers: LeafletMarker[]): void {
    const wikilinkRegex = /\[\[([^\]]+)\]\]/;
    const wikilinkMatch = wikilinkRegex.exec(value);
    const link = wikilinkMatch ? wikilinkMatch[1].trim() : undefined;
    const valueWithoutLink = value.replace(/\[\[[^\]]+\]\]/g, '').trim();
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

  private parseTileServer(value: string): LeafletTileServer {
    return { url: value.trim() };
  }
}
