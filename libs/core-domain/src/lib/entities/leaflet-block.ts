import type { LeafletImageOverlay } from './leaflet-image-overlay';
import type { LeafletMarker } from './leaflet-marker';
import type { LeafletTileServer } from './leaflet-tile-server';

/**
 * Represents a parsed Leaflet code block.
 */
export interface LeafletBlock {
  /**
   * Stable map identity.
   */
  id: string;

  /**
   * Optional rendered map height, for example `500px`.
   */
  height?: string;

  /**
   * Optional rendered map width, for example `100%`.
   */
  width?: string;

  /**
   * Geographic map center latitude.
   */
  lat?: number;

  /**
   * Geographic map center longitude.
   */
  long?: number;

  /**
   * Minimum allowed zoom level.
   */
  minZoom?: number;

  /**
   * Maximum allowed zoom level.
   */
  maxZoom?: number;

  /**
   * Initial zoom level.
   */
  defaultZoom?: number;

  /**
   * Leaflet zoom step applied per interaction.
   */
  zoomDelta?: number;

  /**
   * Optional distance unit label.
   */
  unit?: string;

  /**
   * Logical image-map width used to derive bounds from the real image aspect ratio.
   */
  scale?: number;

  /**
   * Enables dark-mode map styling.
   */
  darkMode?: boolean;

  /**
   * Disables mouse-wheel zoom.
   */
  noScrollZoom?: boolean;

  /**
   * Disables the main interactive controls of the map.
   */
  lock?: boolean;

  /**
   * Image overlays rendered on the map.
   */
  imageOverlays?: LeafletImageOverlay[];

  /**
   * Custom tile server configuration.
   */
  tileServer?: LeafletTileServer;

  /**
   * Markers rendered on the map.
   */
  markers?: LeafletMarker[];

  /**
   * Original block content kept for diagnostics.
   */
  rawContent?: string;
}
