import type { LoggerPort, PublishableNote } from '@core-domain';
import { type BaseService } from '../../common/base-service';
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
export declare class DetectLeafletBlocksService implements BaseService {
    private readonly _logger;
    constructor(logger: LoggerPort);
    process(notes: PublishableNote[]): PublishableNote[];
    /**
     * Parse le contenu brut d'un bloc leaflet.
     * Supporte les formats clé:valeur et YAML.
     */
    private parseLeafletBlock;
    /**
     * Parse une propriété individuelle du bloc Leaflet
     */
    private parseLeafletProperty;
    /**
     * Parse un nombre depuis une chaîne
     */
    private parseNumber;
    /**
     * Parse un booléen depuis une chaîne
     */
    private parseBoolean;
    /**
     * Parse les images overlays.
     * Supporte:
     * - Simple: [[image.png]]
     * - Liste YAML: [[image1.png]], [[image2.png]]
     */
    private parseImageOverlays;
    /**
     * Parse un marqueur.
     * Format attendu: type, lat, long, [[link]] (optionnel)
     * Exemple: default, 50.5, 30.5, [[My Note]]
     */
    private parseMarker;
    private normalizeMarkerValue;
    /**
     * Parse la configuration d'un serveur de tuiles.
     * Format simplifié pour l'instant: URL du serveur
     */
    private parseTileServer;
}
//# sourceMappingURL=detect-leaflet-blocks.service.d.ts.map