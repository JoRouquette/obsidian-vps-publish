import { type IgnoreRule, type LoggerPort, LogLevel, type PublishableNote } from '@core-domain';

import { EvaluateIgnoreRulesHandler } from '../handler/evaluate-ignore-rules.handler';
import { ComputeRoutingService } from './compute-routing.service';
import { DeduplicateNotesService } from './deduplicate-notes.service';
import { DetectWikilinksService } from './detect-wikilinks.service';
import { EnsureTitleHeaderService } from './ensure-title-header.service';
import { RenderInlineDataviewService } from './render-inline-dataview.service';
import { ResolveWikilinksService } from './resolve-wikilinks.service';

export interface DeterministicNoteTransformsOptions {
  ignoreRules?: IgnoreRule[];
  deduplicationEnabled?: boolean;
  ignoreRulesAlreadyApplied?: boolean;
}

class NullLogger implements LoggerPort {
  private _level: LogLevel = LogLevel.info;

  set level(level: LogLevel) {
    this._level = level;
  }

  get level(): LogLevel {
    return this._level;
  }

  child(_context: Record<string, unknown> = {}, level?: LogLevel): LoggerPort {
    if (level !== undefined) {
      this._level = level;
    }
    return this;
  }

  debug(_message: string, ..._args: unknown[]): void {}
  info(_message: string, ..._args: unknown[]): void {}
  warn(_message: string, ..._args: unknown[]): void {}
  error(_message: string, ..._args: unknown[]): void {}
}

/**
 * Applies deterministic, non-Obsidian-dependent transforms authoritatively.
 * This is the server-owned note pipeline used during session finalization.
 */
export class DeterministicNoteTransformsService {
  constructor(private readonly logger?: LoggerPort) {}

  async process(
    notes: PublishableNote[],
    options: DeterministicNoteTransformsOptions = {}
  ): Promise<PublishableNote[]> {
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

    const evaluateIgnoreRules = new EvaluateIgnoreRulesHandler(ignoreRules, baseLogger);
    const inlineDataviewRenderer = new RenderInlineDataviewService(baseLogger);
    const ensureTitleHeader = new EnsureTitleHeaderService(baseLogger);
    const computeRouting = new ComputeRoutingService(baseLogger);
    const detectWikilinks = new DetectWikilinksService(baseLogger);
    const resolveWikilinks = new ResolveWikilinksService(baseLogger, detectWikilinks);
    const deduplicate = new DeduplicateNotesService(baseLogger);

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
