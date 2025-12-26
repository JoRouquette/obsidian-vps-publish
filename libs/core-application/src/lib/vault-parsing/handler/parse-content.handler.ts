import {
  type CollectedNote,
  type LoggerPort,
  type Mapper,
  type PerformanceTrackerPort,
  type PublishableNote,
  type CancellationPort,
} from '@core-domain';

import { type CommandHandler } from '../../common/command-handler';
import { YieldScheduler } from '../../utils/concurrency.util';
import { type ComputeRoutingService } from '../services/compute-routing.service';
import { type DetectAssetsService } from '../services/detect-assets.service';
import { type DetectLeafletBlocksService } from '../services/detect-leaflet-blocks.service';
import { type EnsureTitleHeaderService } from '../services/ensure-title-header.service';
import { type NormalizeFrontmatterService } from '../services/normalize-frontmatter.service';
import { type RemoveNoPublishingMarkerService } from '../services/remove-no-publishing-marker.service';
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
    private readonly removeNoPublishingMarkerService: RemoveNoPublishingMarkerService,
    private readonly assetsDetector: DetectAssetsService,
    private readonly wikilinkResolver: ResolveWikilinksService,
    private readonly computeRoutingService: ComputeRoutingService,
    private readonly logger: LoggerPort,
    private readonly dataviewProcessor?: (
      notes: PublishableNote[],
      cancellation?: CancellationPort
    ) => Promise<PublishableNote[]>,
    private readonly perfTracker?: PerformanceTrackerPort,
    private readonly cancellation?: CancellationPort
  ) {}

  async handle(notes: CollectedNote[]): Promise<PublishableNote[]> {
    const spanId = this.perfTracker?.startSpan('parse-content-full', { notesCount: notes.length });

    this.logger?.debug('ParseContentHandler.handle() called', {
      inputNotesCount: notes.length,
    });

    // Check for cancellation before starting
    this.cancellation?.throwIfCancelled();

    const yieldScheduler = new YieldScheduler(15, 30); // Yield every 15 notes or 30ms (more aggressive)

    // Step 1: Normalize frontmatter
    this.cancellation?.throwIfCancelled();
    let stepSpan = this.perfTracker?.startSpan('normalize-frontmatter');
    let normalizedNotes: CollectedNote[] = this.normalizeFrontmatterService.process(notes);
    this.perfTracker?.endSpan(stepSpan!, { notesProcessed: normalizedNotes.length });

    this.logger?.debug('Frontmatter normalized', {
      notesCount: normalizedNotes.length,
    });

    await yieldScheduler.maybeYield();

    // Step 2: Convert to PublishableNote
    this.cancellation?.throwIfCancelled();
    stepSpan = this.perfTracker?.startSpan('map-to-publishable');
    const converted = normalizedNotes.map(this.noteMapper.map);
    this.perfTracker?.endSpan(stepSpan!, { notesProcessed: converted.length });

    this.logger?.debug('Notes converted to PublishableNote', {
      notesCount: converted.length,
    });

    await yieldScheduler.maybeYield();

    // Step 3: Evaluate ignore rules
    this.cancellation?.throwIfCancelled();
    stepSpan = this.perfTracker?.startSpan('evaluate-ignore-rules');
    let publishableNotes = (await this.evaluateIgnoreRulesHandler.handle(converted))
      .map((note) => {
        if (note.eligibility?.isPublishable) {
          return note;
        }
        return undefined;
      })
      .filter((n): n is PublishableNote => n !== undefined);
    this.perfTracker?.endSpan(stepSpan!, {
      publishableCount: publishableNotes.length,
      ignoredCount: converted.length - publishableNotes.length,
    });

    this.logger?.debug('Ignore rules evaluated', {
      publishableNotesCount: publishableNotes.length,
      ignoredCount: converted.length - publishableNotes.length,
    });

    await yieldScheduler.maybeYield();

    // Step 4: Inline dataview
    this.cancellation?.throwIfCancelled();
    stepSpan = this.perfTracker?.startSpan('inline-dataview-render');
    publishableNotes = this.inlineDataviewRenderer.process(publishableNotes);
    this.perfTracker?.endSpan(stepSpan!, { notesProcessed: publishableNotes.length });

    this.logger?.debug('Inline dataview processed', {
      notesCount: publishableNotes.length,
    });

    await yieldScheduler.maybeYield();

    // Step 5: Process Dataview blocks (async, potentially slow)
    if (this.dataviewProcessor) {
      this.cancellation?.throwIfCancelled();
      stepSpan = this.perfTracker?.startSpan('dataview-blocks-process');

      this.logger?.debug('Processing Dataview blocks', {
        notesCount: publishableNotes.length,
        notesWithDataview: publishableNotes.filter((n) => n.content.includes('```dataview')).length,
      });

      publishableNotes = await this.dataviewProcessor(publishableNotes, this.cancellation);
      this.perfTracker?.endSpan(stepSpan!, { notesProcessed: publishableNotes.length });

      this.logger?.debug('Dataview blocks processed', {
        notesCount: publishableNotes.length,
      });

      await yieldScheduler.maybeYield();
    }

    // Step 6: Leaflet blocks
    this.cancellation?.throwIfCancelled();
    stepSpan = this.perfTracker?.startSpan('detect-leaflet-blocks');
    publishableNotes = this.leafletBlocksDetector.process(publishableNotes);
    this.perfTracker?.endSpan(stepSpan!, { notesProcessed: publishableNotes.length });

    await yieldScheduler.maybeYield();

    // Step 7: Ensure title header
    this.cancellation?.throwIfCancelled();
    stepSpan = this.perfTracker?.startSpan('ensure-title-header');
    publishableNotes = this.ensureTitleHeaderService.process(publishableNotes);
    this.perfTracker?.endSpan(stepSpan!, { notesProcessed: publishableNotes.length });

    await yieldScheduler.maybeYield();

    // Step 8: Remove no-publishing markers
    this.cancellation?.throwIfCancelled();
    stepSpan = this.perfTracker?.startSpan('remove-no-publishing-markers');
    publishableNotes = this.removeNoPublishingMarkerService.process(publishableNotes);
    this.perfTracker?.endSpan(stepSpan!, { notesProcessed: publishableNotes.length });

    this.logger?.debug('^no-publishing markers processed', {
      notesCount: publishableNotes.length,
    });

    await yieldScheduler.maybeYield();

    // Step 9: Detect assets
    this.cancellation?.throwIfCancelled();
    stepSpan = this.perfTracker?.startSpan('detect-assets');
    publishableNotes = this.assetsDetector.process(publishableNotes);
    this.perfTracker?.endSpan(stepSpan!, { notesProcessed: publishableNotes.length });

    await yieldScheduler.maybeYield();

    // Step 10: Resolve wikilinks
    this.cancellation?.throwIfCancelled();
    stepSpan = this.perfTracker?.startSpan('resolve-wikilinks');
    publishableNotes = this.wikilinkResolver.process(publishableNotes);
    this.perfTracker?.endSpan(stepSpan!, { notesProcessed: publishableNotes.length });

    await yieldScheduler.maybeYield();

    // Step 11: Compute routing
    this.cancellation?.throwIfCancelled();
    stepSpan = this.perfTracker?.startSpan('compute-routing');
    publishableNotes = this.computeRoutingService.process(publishableNotes);
    this.perfTracker?.endSpan(stepSpan!, { notesProcessed: publishableNotes.length });

    this.perfTracker?.endSpan(spanId!, {
      totalNotesProcessed: publishableNotes.length,
    });

    return publishableNotes;
  }
}
