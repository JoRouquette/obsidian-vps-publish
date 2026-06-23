import { type PublishableNote } from '@core-domain/entities';
import { type AssetRef } from '@core-domain/entities/asset-ref';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import { type BaseService } from '../../common/base-service';
export declare class DetectAssetsService implements BaseService {
    private readonly _logger;
    constructor(logger: LoggerPort);
    process(notes: PublishableNote[]): PublishableNote[];
    detectForContentOverride(note: PublishableNote, renderedContent: string): AssetRef[];
    private classifyAssetKind;
    private parseAlignment;
    private detectInFrontmatter;
    private detectInText;
    private detectObsidianEmbeds;
    private parseModifiers;
    private detectMarkdownImages;
    /**
     * Detect exportable assets from serialized HTML without trying to "support" icon runtimes.
     *
     * Supported:
     * - <img src="...">
     * - <img data-src="...">
     * - <a href="..."> when the href clearly targets a file asset
     *
     * Intentionally not detected here:
     * - inline SVG fragments (<svg>...</svg>)
     * - DOM-only icons (<span>, <i>, emoji, data-icon)
     * - CSS/runtime-only icon packs
     * - advanced media syntaxes such as srcset or CSS url(...)
     */
    private detectHtmlAssetRefs;
    private normalizeTarget;
    private normalizeHtmlAssetTarget;
    private parseMarkdownImageDestination;
    private isExternalOrRuntimeUrl;
    private extractHtmlAttribute;
    private emptyDisplay;
    private mergeAssets;
    /**
     * Détecte les assets dans les blocs Leaflet (imageOverlays)
     */
    private detectInLeafletBlocks;
}
//# sourceMappingURL=detect-assets.service.d.ts.map