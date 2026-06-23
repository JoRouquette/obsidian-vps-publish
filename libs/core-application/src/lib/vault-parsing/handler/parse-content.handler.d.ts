import { type CancellationPort, type CollectedNote, type LoggerPort, type Mapper, type PerformanceTrackerPort, type PublishableNote } from '@core-domain';
import { type CommandHandler } from '../../common/command-handler';
import { type DetectAssetsService } from '../services/detect-assets.service';
import { type DetectLeafletBlocksService } from '../services/detect-leaflet-blocks.service';
import { type NormalizeFrontmatterService } from '../services/normalize-frontmatter.service';
import { type RemoveNoPublishingMarkerService } from '../services/remove-no-publishing-marker.service';
import { type RenderInlineDataviewService } from '../services/render-inline-dataview.service';
import { type EvaluateIgnoreRulesHandler } from './evaluate-ignore-rules.handler';
export declare class ParseContentHandler implements CommandHandler<CollectedNote[], PublishableNote[]> {
    private readonly normalizeFrontmatterService;
    private readonly evaluateIgnoreRulesHandler;
    private readonly noteMapper;
    private readonly inlineDataviewRenderer;
    private readonly leafletBlocksDetector;
    private readonly removeNoPublishingMarkerService;
    private readonly assetsDetector;
    private readonly logger;
    private readonly dataviewProcessor?;
    private readonly perfTracker?;
    private readonly cancellation?;
    constructor(normalizeFrontmatterService: NormalizeFrontmatterService, evaluateIgnoreRulesHandler: EvaluateIgnoreRulesHandler, noteMapper: Mapper<CollectedNote, PublishableNote>, inlineDataviewRenderer: RenderInlineDataviewService, leafletBlocksDetector: DetectLeafletBlocksService, removeNoPublishingMarkerService: RemoveNoPublishingMarkerService, assetsDetector: DetectAssetsService, logger: LoggerPort, dataviewProcessor?: ((notes: PublishableNote[], cancellation?: CancellationPort) => Promise<PublishableNote[]>) | undefined, perfTracker?: PerformanceTrackerPort | undefined, cancellation?: CancellationPort | undefined);
    handle(notes: CollectedNote[]): Promise<PublishableNote[]>;
}
//# sourceMappingURL=parse-content.handler.d.ts.map