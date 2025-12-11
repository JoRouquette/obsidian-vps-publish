/**
 * Représente un marqueur sur une carte Leaflet.
 * Basé sur la documentation officielle d'Obsidian Leaflet plugin.
 */
export interface LeafletMarker {
  /**
   * Type/description du marqueur (ex: "default", "custom-icon", etc.)
   */
  type?: string;

  /**
   * Latitude du marqueur
   */
  lat: number;

  /**
   * Longitude du marqueur
   */
  long: number;

  /**
   * Lien vers une note Obsidian (wikilink) ou URL externe
   */
  link?: string;

  /**
   * Description ou texte à afficher dans la popup du marqueur
   */
  description?: string;

  /**
   * Taille min de zoom pour afficher le marqueur
   */
  minZoom?: number;

  /**
   * Taille max de zoom pour afficher le marqueur
   */
  maxZoom?: number;
}
