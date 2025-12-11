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
  /**
   * Identifiant unique du bloc Leaflet (obligatoire)
   */
  id: string;

  /**
   * Hauteur de la carte (ex: "500px", "100%")
   */
  height?: string;

  /**
   * Largeur de la carte (ex: "100%", "800px")
   */
  width?: string;

  /**
   * Latitude du centre de la carte
   */
  lat?: number;

  /**
   * Longitude du centre de la carte
   */
  long?: number;

  /**
   * Zoom minimum
   */
  minZoom?: number;

  /**
   * Zoom maximum
   */
  maxZoom?: number;

  /**
   * Zoom par défaut au chargement
   */
  defaultZoom?: number;

  /**
   * Unité de mesure (ex: "meters", "feet", "miles")
   */
  unit?: string;

  /**
   * Mode sombre activé
   */
  darkMode?: boolean;

  /**
   * Image overlay(s) pour la carte
   * Peut être une seule image ou une liste d'images
   */
  imageOverlays?: LeafletImageOverlay[];

  /**
   * Configuration du serveur de tuiles personnalisé
   */
  tileServer?: LeafletTileServer;

  /**
   * Liste des marqueurs sur la carte
   */
  markers?: LeafletMarker[];

  /**
   * Contenu brut du bloc (pour debug/traçabilité)
   */
  rawContent?: string;
}
