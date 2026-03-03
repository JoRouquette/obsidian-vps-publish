import type { LeafletImageOverlay } from './leaflet-image-overlay';
import type { LeafletMarker } from './leaflet-marker';
import type { LeafletTileServer } from './leaflet-tile-server';

/**
 * Représente un bloc de carte Leaflet complet.
 * Basé sur la documentation officielle d'Obsidian Leaflet plugin (javalent/obsidian-leaflet).
 *
 * Supporte la syntaxe :
 * ```leaflet
 * id: unique-map-id
 * image: [[image.png]]
 * lat: 50.5
 * long: 30.5
 * minZoom: 1
 * maxZoom: 10
 * defaultZoom: 5
 * unit: meters
 * height: 500px
 * width: 100%
 * marker: default, 50.5, 30.5, [[Note]]
 * darkMode: true
 * ```
 */
export interface LeafletBlock {
  /** Version du schéma (DTO v1) */
  version: 1;

  /** Identifiant unique du bloc Leaflet (obligatoire ou généré) */
  id: string;

  /** Mode principal : 'image' (CRS.Simple + ImageOverlay) ou 'tile' (TileLayer) */
  type: 'image' | 'tile';

  /** Latitude du centre de la carte (mode tile) */
  lat?: number;
  /** Longitude du centre de la carte (mode tile) */
  long?: number;

  /** Hauteur de la carte (ex: "500px", "100%") */
  height?: string;
  /** Largeur de la carte (ex: "100%", "800px") */
  width?: string;

  /** Zooms */
  defaultZoom?: number;
  minZoom?: number;
  maxZoom?: number;

  /** Mode sombre */
  darkMode?: boolean;
  /** Unité de mesure (ex: "meters", "px", etc.) */
  unit?: string;

  /** Image map mode : assetRef publié, bounds, alias */
  image?: {
    assetRef: string;
    bounds?: [[number, number], [number, number]];
    alias?: string;
  };

  /** Tile map mode : configuration du serveur de tuiles */
  tileServer?: LeafletTileServer;

  /** Markers : type, lat, long, lien, description, minZoom/maxZoom */
  markers?: LeafletMarker[];

  /** GeoJSON overlays : assetRef ou URL, style */
  geojson?: Array<{
    assetRef: string;
    style?: Record<string, unknown>;
  }>;

  /** Overlays (cercles, etc.) */
  overlays?: Array<{
    type: 'circle';
    lat: number;
    long: number;
    radius: number;
    color?: string;
  }>;

  /** Image overlays pour cartes personnalisées */
  imageOverlays?: LeafletImageOverlay[];

  /** Contenu brut du bloc (pour debug/traçabilité) */
  rawContent?: string;
}
