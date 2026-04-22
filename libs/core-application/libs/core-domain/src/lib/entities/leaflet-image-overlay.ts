/**
 * Configuration d'une image overlay pour carte Leaflet.
 * Permet d'afficher une image personnalisée sur la carte.
 */
export interface LeafletImageOverlay {
  /**
   * Chemin vers l'image (peut être un wikilink Obsidian [[image.png]] ou chemin relatif)
   */
  path: string;

  /**
   * Coordonnées du coin supérieur gauche [lat, long]
   */
  topLeft: [number, number];

  /**
   * Coordonnées du coin inférieur droit [lat, long]
   */
  bottomRight: [number, number];

  /**
   * Alias ou nom de l'image (optionnel)
   */
  alias?: string;
}
