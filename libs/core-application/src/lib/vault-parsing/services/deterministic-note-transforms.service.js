"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeterministicNoteTransformsService = void 0;
const _core_domain_1 = require("@core-domain");
const evaluate_ignore_rules_handler_1 = require("../handler/evaluate-ignore-rules.handler");
const compute_routing_service_1 = require("./compute-routing.service");
const deduplicate_notes_service_1 = require("./deduplicate-notes.service");
const detect_wikilinks_service_1 = require("./detect-wikilinks.service");
const ensure_title_header_service_1 = require("./ensure-title-header.service");
const render_inline_dataview_service_1 = require("./render-inline-dataview.service");
const resolve_wikilinks_service_1 = require("./resolve-wikilinks.service");
class NullLogger {
    constructor() {
        this._level = _core_domain_1.LogLevel.info;
    }
    set level(level) {
        this._level = level;
    }
    get level() {
        return this._level;
    }
    child(_context = {}, level) {
        if (level !== undefined) {
            this._level = level;
        }
        return this;
    }
    debug(_message, ..._args) { }
    info(_message, ..._args) { }
    warn(_message, ..._args) { }
    error(_message, ..._args) { }
}
/**
 * Applies deterministic, non-Obsidian-dependent transforms authoritatively.
 * This is the server-owned note pipeline used during session finalization.
 */
class DeterministicNoteTransformsService {
    constructor(logger) {
        this.logger = logger;
    }
    async process(notes, options = {}) {
        const baseLogger = this.logger ?? new NullLogger();
        const log = baseLogger.child({ service: 'DeterministicNoteTransformsService' });
        const ignoreRules = options.ignoreRules ?? [];
        const deduplicationEnabled = options.deduplicationEnabled !== false;
        const ignoreRulesAlreadyApplied = options.ignoreRulesAlreadyApplied === true;
        log?.debug('Applying deterministic note transforms', {
            notesCount: notes.length,
            ignoreRulesCount: ignoreRules.length,
            deduplicationEnabled,
            ignoreRulesAlreadyApplied,
        });
        const evaluateIgnoreRules = new evaluate_ignore_rules_handler_1.EvaluateIgnoreRulesHandler(ignoreRules, baseLogger);
        const inlineDataviewRenderer = new render_inline_dataview_service_1.RenderInlineDataviewService(baseLogger);
        const ensureTitleHeader = new ensure_title_header_service_1.EnsureTitleHeaderService(baseLogger);
        const computeRouting = new compute_routing_service_1.ComputeRoutingService(baseLogger);
        const detectWikilinks = new detect_wikilinks_service_1.DetectWikilinksService(baseLogger);
        const resolveWikilinks = new resolve_wikilinks_service_1.ResolveWikilinksService(baseLogger, detectWikilinks);
        const deduplicate = new deduplicate_notes_service_1.DeduplicateNotesService(baseLogger);
        const evaluated = ignoreRulesAlreadyApplied ? notes : await evaluateIgnoreRules.handle(notes);
        const publishableNotes = evaluated.filter((note) => note.eligibility?.isPublishable !== false);
        const withInlineDataview = inlineDataviewRenderer.process(publishableNotes);
        const withTitleHeaders = ensureTitleHeader.process(withInlineDataview);
        const routed = computeRouting.process(withTitleHeaders);
        const deduplicated = deduplicationEnabled ? deduplicate.process(routed) : routed;
        const resolved = resolveWikilinks.process(deduplicated);
        log?.debug('Deterministic note transforms complete', {
            inputCount: notes.length,
            publishableCount: publishableNotes.length,
            outputCount: resolved.length,
        });
        return resolved;
    }
}
exports.DeterministicNoteTransformsService = DeterministicNoteTransformsService;
