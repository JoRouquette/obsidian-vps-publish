"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParseContentHandler = void 0;
const concurrency_util_1 = require("../../utils/concurrency.util");
class ParseContentHandler {
    constructor(normalizeFrontmatterService, evaluateIgnoreRulesHandler, noteMapper, inlineDataviewRenderer, leafletBlocksDetector, removeNoPublishingMarkerService, assetsDetector, logger, dataviewProcessor, perfTracker, cancellation) {
        this.normalizeFrontmatterService = normalizeFrontmatterService;
        this.evaluateIgnoreRulesHandler = evaluateIgnoreRulesHandler;
        this.noteMapper = noteMapper;
        this.inlineDataviewRenderer = inlineDataviewRenderer;
        this.leafletBlocksDetector = leafletBlocksDetector;
        this.removeNoPublishingMarkerService = removeNoPublishingMarkerService;
        this.assetsDetector = assetsDetector;
        this.logger = logger;
        this.dataviewProcessor = dataviewProcessor;
        this.perfTracker = perfTracker;
        this.cancellation = cancellation;
    }
    async handle(notes) {
        const spanId = this.perfTracker?.startSpan('parse-content-full', { notesCount: notes.length });
        this.logger?.debug('ParseContentHandler.handle() called', {
            inputNotesCount: notes.length,
        });
        // Check for cancellation before starting
        this.cancellation?.throwIfCancelled();
        const yieldScheduler = new concurrency_util_1.YieldScheduler(15, 30); // Yield every 15 notes or 30ms (more aggressive)
        // Step 1: Normalize frontmatter
        this.cancellation?.throwIfCancelled();
        let stepSpan = this.perfTracker?.startSpan('normalize-frontmatter');
        let normalizedNotes = this.normalizeFrontmatterService.process(notes);
        this.perfTracker?.endSpan(stepSpan, { notesProcessed: normalizedNotes.length });
        this.logger?.debug('Frontmatter normalized', {
            notesCount: normalizedNotes.length,
        });
        await yieldScheduler.maybeYield();
        // Step 2: Convert to PublishableNote
        this.cancellation?.throwIfCancelled();
        stepSpan = this.perfTracker?.startSpan('map-to-publishable');
        const converted = normalizedNotes.map(this.noteMapper.map);
        this.perfTracker?.endSpan(stepSpan, { notesProcessed: converted.length });
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
            .filter((n) => n !== undefined);
        this.perfTracker?.endSpan(stepSpan, {
            publishableCount: publishableNotes.length,
            ignoredCount: converted.length - publishableNotes.length,
        });
        this.logger?.debug('Ignore rules evaluated', {
            publishableNotesCount: publishableNotes.length,
            ignoredCount: converted.length - publishableNotes.length,
        });
        await yieldScheduler.maybeYield();
        // Step 4: Remove no-publishing markers early
        this.cancellation?.throwIfCancelled();
        stepSpan = this.perfTracker?.startSpan('remove-no-publishing-markers-pre');
        publishableNotes = this.removeNoPublishingMarkerService.process(publishableNotes);
        this.perfTracker?.endSpan(stepSpan, { notesProcessed: publishableNotes.length });
        this.logger?.debug('^no-publishing markers pre-processed', {
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
            this.perfTracker?.endSpan(stepSpan, { notesProcessed: publishableNotes.length });
            this.logger?.debug('Dataview blocks processed', {
                notesCount: publishableNotes.length,
            });
            await yieldScheduler.maybeYield();
        }
        // Step 6: Remove no-publishing markers after Dataview rendering
        this.cancellation?.throwIfCancelled();
        stepSpan = this.perfTracker?.startSpan('remove-no-publishing-markers-post-dataview');
        publishableNotes = this.removeNoPublishingMarkerService.process(publishableNotes);
        this.perfTracker?.endSpan(stepSpan, { notesProcessed: publishableNotes.length });
        await yieldScheduler.maybeYield();
        // Step 7: Leaflet blocks
        this.cancellation?.throwIfCancelled();
        stepSpan = this.perfTracker?.startSpan('detect-leaflet-blocks');
        publishableNotes = this.leafletBlocksDetector.process(publishableNotes);
        this.perfTracker?.endSpan(stepSpan, { notesProcessed: publishableNotes.length });
        await yieldScheduler.maybeYield();
        // Step 8: Detect uploadable assets after Dataview/DataviewJS rendering has converged in note content.
        // Invariant:
        // - this step may look at inline Dataview rendered content to discover assets
        // - it must not become a second routing/rendering pipeline
        // - final HTML URL canonicalization remains backend-owned
        this.cancellation?.throwIfCancelled();
        stepSpan = this.perfTracker?.startSpan('detect-assets');
        publishableNotes = publishableNotes.map((note) => ({
            ...note,
            assets: this.assetsDetector.detectForContentOverride(note, this.inlineDataviewRenderer.renderContent(note.content, note.frontmatter)),
        }));
        this.perfTracker?.endSpan(stepSpan, { notesProcessed: publishableNotes.length });
        await yieldScheduler.maybeYield();
        this.logger?.debug('Deterministic note transforms deferred to API finalization', {
            notesCount: publishableNotes.length,
        });
        this.perfTracker?.endSpan(spanId, {
            totalNotesProcessed: publishableNotes.length,
        });
        return publishableNotes;
    }
}
exports.ParseContentHandler = ParseContentHandler;
