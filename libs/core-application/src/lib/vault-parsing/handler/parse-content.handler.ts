import { CollectedNote, LoggerPort, Mapper, PublishableNote } from '@core-domain';
import { CommandHandler } from '../../common/command-handler';
import { NormalizeFrontmatterService } from '../services/normalize-frontmatter.service';
import { EvaluateIgnoreRulesHandler } from './evaluate-ignore-rules.handler';
import { RenderInlineDataviewService } from '../services/render-inline-dataview.service';
import { ContentSanitizerService } from '../services/content-sanitizer.service';
import { DetectAssetsService } from '../services/detect-assets.service';
import { ResolveWikilinksService } from '../services/resolve-wikilinks.service';
import { ComputeRoutingService } from '../services/compute-routing.service';

export class ParseContentHandler implements CommandHandler<CollectedNote[], PublishableNote[]> {
  constructor(
    private readonly normalizeFrontmatterService: NormalizeFrontmatterService,
    private readonly evaluateIgnoreRulesHandler: EvaluateIgnoreRulesHandler,
    private readonly noteMapper: Mapper<CollectedNote, PublishableNote>,
    private readonly inlineDataviewRenderer: RenderInlineDataviewService,
    private readonly contentSanitizer: ContentSanitizerService,
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

    publishableNotes = this.contentSanitizer.process(publishableNotes);

    publishableNotes = this.assetsDetector.process(publishableNotes);

    publishableNotes = this.wikilinkResolver.process(publishableNotes);

    publishableNotes = this.computeRoutingService.process(publishableNotes);

    return publishableNotes;
  }
}
