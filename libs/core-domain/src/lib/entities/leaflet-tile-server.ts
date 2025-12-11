/**
 * Configuration d'un serveur de tuiles pour carte Leaflet.
 */
export interface LeafletTileServer {
  /**
   * URL template du serveur de tuiles (ex: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png")
   */
  url: string;

  /**
   * Sous-domaines disponibles (ex: ["a", "b", "c"])
   */
  subdomains?: string[];

  /**
   * Attribution du serveur de tuiles
   */
  attribution?: string;

  /**
   * Zoom minimum supporté par le serveur
   */
  minZoom?: number;

  /**
   * Zoom maximum supporté par le serveur
   */
  maxZoom?: number;
}
