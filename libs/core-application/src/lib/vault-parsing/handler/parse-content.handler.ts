import {
  type CollectedNote,
  type LoggerPort,
  type Mapper,
  type PublishableNote,
} from '@core-domain';

import { type CommandHandler } from '../../common/command-handler';
import { type ComputeRoutingService } from '../services/compute-routing.service';
import { type DetectAssetsService } from '../services/detect-assets.service';
import { type DetectLeafletBlocksService } from '../services/detect-leaflet-blocks.service';
import { type EnsureTitleHeaderService } from '../services/ensure-title-header.service';
import { type NormalizeFrontmatterService } from '../services/normalize-frontmatter.service';
import { type RenderInlineDataviewService } from '../services/render-inline-dataview.service';
import { type ResolveWikilinksService } from '../services/resolve-wikilinks.service';
import { type EvaluateIgnoreRulesHandler } from './evaluate-ignore-rules.handler';

export class ParseContentHandler implements CommandHandler<CollectedNote[], PublishableNote[]> {
  constructor(
    private readonly normalizeFrontmatterService: NormalizeFrontmatterService,
    private readonly evaluateIgnoreRulesHandler: EvaluateIgnoreRulesHandler,
    private readonly noteMapper: Mapper<CollectedNote, PublishableNote>,
    private readonly inlineDataviewRenderer: RenderInlineDataviewService,
    private readonly leafletBlocksDetector: DetectLeafletBlocksService,
    private readonly ensureTitleHeaderService: EnsureTitleHeaderService,
    private readonly assetsDetector: DetectAssetsService,
    private readonly wikilinkResolver: ResolveWikilinksService,
    private readonly computeRoutingService: ComputeRoutingService,
    private readonly logger: LoggerPort
  ) {}

  async handle(notes: CollectedNote[]): Promise<PublishableNote[]> {
    let normalizedNotes: CollectedNote[] = this.normalizeFrontmatterService.process(notes);

    const converted = normalizedNotes.map(this.noteMapper.map);

    let publishableNotes = (await this.evaluateIgnoreRulesHandler.handle(converted))
      .map((note) => {
        if (note.eligibility?.isPublishable) {
          return note;
        }
        return undefined;
      })
      .filter((n): n is PublishableNote => n !== undefined);

    publishableNotes = this.inlineDataviewRenderer.process(publishableNotes);

    publishableNotes = this.leafletBlocksDetector.process(publishableNotes);

    publishableNotes = this.ensureTitleHeaderService.process(publishableNotes);

    publishableNotes = this.assetsDetector.process(publishableNotes);

    publishableNotes = this.wikilinkResolver.process(publishableNotes);

    publishableNotes = this.computeRoutingService.process(publishableNotes);

    return publishableNotes;
  }
}
