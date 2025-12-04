import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  ComputeRoutingService,
  DetectWikilinksService,
  MarkdownRendererPort,
  ResolveWikilinksService,
  UploadNotesHandler,
} from '@core-application';
import { ContentStoragePort, ManifestPort, SessionNotesStoragePort } from '@core-application';
import { LoggerPort } from '@core-domain';

import { StagingManager } from '../filesystem/staging-manager';

type ContentStorageFactory = (sessionId: string) => ContentStoragePort;
type ManifestStorageFactory = (sessionId: string) => ManifestPort;

class NullLogger implements LoggerPort {
  private _level: any = 0;
  set level(level: any) {
    this._level = level;
  }
  get level() {
    return this._level;
  }
  child(): LoggerPort {
    return this;
  }
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

/**
 * Rebuilds the HTML for a session once all notes have been uploaded, so
 * wikilinks are resolved against the full batch (not per HTTP chunk).
 */
export class SessionFinalizerService {
  private readonly logger: LoggerPort;

  constructor(
    private readonly notesStorage: SessionNotesStoragePort,
    private readonly stagingManager: StagingManager,
    private readonly markdownRenderer: MarkdownRendererPort,
    private readonly contentStorage: ContentStorageFactory,
    private readonly manifestStorage: ManifestStorageFactory,
    logger?: LoggerPort
  ) {
    this.logger = logger?.child({ service: 'SessionFinalizerService' }) ?? new NullLogger();
  }

  async rebuildFromStored(sessionId: string): Promise<void> {
    const log = this.logger.child({ sessionId });
    const rawNotes = await this.notesStorage.loadAll(sessionId);

    if (rawNotes.length === 0) {
      log.warn('No raw notes found for session; skipping rebuild');
      return;
    }

    log.info('Rebuilding session content from stored notes', { count: rawNotes.length });

    const detect = new DetectWikilinksService(this.logger);
    const resolve = new ResolveWikilinksService(this.logger, detect);
    const computeRouting = new ComputeRoutingService(this.logger);

    const withLinks = resolve.process(rawNotes);
    const routed = computeRouting.process(withLinks);

    const contentStage = this.stagingManager.contentStagingPath(sessionId);
    await this.resetContentStage(contentStage, log);

    const renderer = new UploadNotesHandler(
      this.markdownRenderer,
      this.contentStorage,
      this.manifestStorage,
      this.logger
    );

    await renderer.handle({ sessionId, notes: routed });

    await this.notesStorage.clear(sessionId);
    log.info('Session rebuild complete');
  }

  private async resetContentStage(contentStage: string, log: LoggerPort) {
    await fs.rm(contentStage, { recursive: true, force: true });
    await fs.mkdir(contentStage, { recursive: true });
    log.debug('Content staging directory reset', { contentStage });

    // Make sure the raw notes folder exists so we can re-use it when needed.
    const rawDir = path.join(contentStage, '_raw-notes');
    await fs.mkdir(rawDir, { recursive: true });
  }
}
