import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  ComputeRoutingService,
  ContentSanitizerService,
  type ContentStoragePort,
  DetectLeafletBlocksService,
  DetectWikilinksService,
  type ManifestPort,
  type MarkdownRendererPort,
  ResolveWikilinksService,
  type SessionNotesStoragePort,
  type SessionRepository,
  UploadNotesHandler,
} from '@core-application';
import { type CustomIndexConfig, type LoggerPort, LogLevel } from '@core-domain';

import { type StagingManager } from '../filesystem/staging-manager';
import { ContentSearchIndexer } from '../search/content-search-indexer';

type ContentStorageFactory = (sessionId: string) => ContentStoragePort;
type ManifestStorageFactory = (sessionId: string) => ManifestPort;

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
    private readonly sessionRepository: SessionRepository,
    logger?: LoggerPort
  ) {
    this.logger = logger?.child({ service: 'SessionFinalizerService' }) ?? new NullLogger();
  }

  async rebuildFromStored(sessionId: string): Promise<void> {
    const startTime = performance.now();
    const log = this.logger.child({ sessionId });
    const timings: Record<string, number> = {};

    // STEP 0: Load raw notes
    let stepStart = performance.now();
    const rawNotes = await this.notesStorage.loadAll(sessionId);
    timings.loadRawNotes = performance.now() - stepStart;

    if (rawNotes.length === 0) {
      log.warn('No raw notes found for session; skipping rebuild');
      return;
    }

    log.debug('Rebuilding session content from stored notes', { count: rawNotes.length });

    // STEP 1: Load session metadata
    stepStart = performance.now();
    const session = await this.sessionRepository.findById(sessionId);
    const customIndexConfigs = session?.customIndexConfigs ?? [];
    timings.loadSessionMetadata = performance.now() - stepStart;
    log.debug('Loaded custom index configs from session', { count: customIndexConfigs.length });

    // STEP 2: Load cleanup rules
    stepStart = performance.now();
    const cleanupRules = await this.notesStorage.loadCleanupRules(sessionId);
    timings.loadCleanupRules = performance.now() - stepStart;
    log.debug('Loaded cleanup rules for session', {
      count: cleanupRules.length,
      rules: cleanupRules.map((r) => ({
        id: r.id,
        name: r.name,
        enabled: r.isEnabled,
        hasRegex: !!r.regex,
        regexLength: r.regex?.length,
      })),
    });

    // STEP 3: Detect plugin blocks (Leaflet) BEFORE sanitization
    // Note: Dataview blocks are now pre-serialized by the plugin and included in serializedDataviewBlocks.
    // The server no longer attempts to detect or execute Dataview queries.
    // The plugin converts Dataview blocks to native Markdown before upload.

    const leafletDetector = new DetectLeafletBlocksService(this.logger);
    const withLeaflet = leafletDetector.process(rawNotes);

    // Étape 3: Sanitization du contenu (supprime les blocks de code restants + frontmatter)
    const contentSanitizer = new ContentSanitizerService(
      cleanupRules,
      undefined,
      undefined,
      this.logger
    );
    const sanitized = contentSanitizer.process(withLeaflet);

    // STEP 4: Convert markdown links to wikilinks before detection
    stepStart = performance.now();
    const withConvertedLinks = sanitized.map((note) => ({
      ...note,
      content: this.convertMarkdownLinksToWikilinks(note.content),
    }));
    timings.convertMarkdownLinks = performance.now() - stepStart;

    // STEP 5: Resolve wikilinks and compute routing
    stepStart = performance.now();
    const detect = new DetectWikilinksService(this.logger);
    const resolve = new ResolveWikilinksService(this.logger, detect);
    const computeRouting = new ComputeRoutingService(this.logger);

    const withLinks = resolve.process(withConvertedLinks);
    const routed = computeRouting.process(withLinks);
    timings.resolveWikilinksAndRouting = performance.now() - stepStart;

    // STEP 7: Reset content staging directory
    stepStart = performance.now();
    const contentStage = this.stagingManager.contentStagingPath(sessionId);
    await this.resetContentStage(contentStage, log);
    timings.resetContentStage = performance.now() - stepStart;

    // STEP 8: Render markdown to HTML
    stepStart = performance.now();
    const renderer = new UploadNotesHandler(
      this.markdownRenderer,
      this.contentStorage,
      this.manifestStorage,
      this.logger,
      undefined, // notesStorage not needed here
      session?.ignoredTags // Pass ignoredTags from session
    );

    // Publier toutes les notes (y compris les fichiers d'index custom)
    await renderer.handle({ sessionId, notes: routed });
    timings.renderMarkdownToHtml = performance.now() - stepStart;

    // STEP 9: Extract custom index HTML and update manifest
    stepStart = performance.now();
    const customIndexesHtml = await this.extractCustomIndexesHtml(
      customIndexConfigs,
      sessionId,
      log
    );
    timings.extractCustomIndexes = performance.now() - stepStart;

    // STEP 10: Rebuild indexes with custom content
    stepStart = performance.now();
    const manifestPort = this.manifestStorage(sessionId);
    const manifest = await manifestPort.load();
    if (manifest) {
      await manifestPort.rebuildIndex(manifest, customIndexesHtml);
      log.debug('Indexes rebuilt with custom content');
    }
    timings.rebuildIndexes = performance.now() - stepStart;

    // STEP 11: Rebuild content search index
    stepStart = performance.now();
    await this.rebuildContentSearchIndex(sessionId);
    timings.rebuildSearchIndex = performance.now() - stepStart;

    // STEP 12: Clear session storage
    stepStart = performance.now();
    await this.notesStorage.clear(sessionId);
    timings.clearSessionStorage = performance.now() - stepStart;

    // Calculate total duration
    const totalDuration = performance.now() - startTime;
    timings.total = totalDuration;

    // Log detailed timing breakdown
    log.info('[PERF] Session rebuild completed', {
      sessionId,
      notesCount: rawNotes.length,
      totalDurationMs: totalDuration.toFixed(2),
      timings: Object.entries(timings).map(([step, duration]) => ({
        step,
        durationMs: duration.toFixed(2),
        percentOfTotal: ((duration / totalDuration) * 100).toFixed(1),
      })),
    });

    log.debug('Session rebuild complete');
  }

  /**
   * Extract HTML content from custom index files and remove them from manifest
   * Custom index files are already published as normal pages, we just need to:
   * 1. Read their generated HTML
   * 2. Remove them from the manifest to avoid duplication
   */
  private async extractCustomIndexesHtml(
    configs: CustomIndexConfig[],
    sessionId: string,
    log: LoggerPort
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();

    if (configs.length === 0) {
      return result;
    }

    log.debug('Extracting custom index HTML and removing from manifest', {
      count: configs.length,
      configs: configs.map((c) => ({
        indexFilePath: c.indexFilePath,
        folderPath: c.folderPath,
        isRootIndex: c.isRootIndex,
      })),
    });

    const manifestPort = this.manifestStorage(sessionId);
    const manifest = await manifestPort.load();

    if (!manifest) {
      log.warn('No manifest found, cannot extract custom indexes');
      return result;
    }

    log.debug('Manifest loaded', {
      pagesCount: manifest.pages.length,
      vaultPaths: manifest.pages.map((p) => p.vaultPath),
    });

    const contentPort = this.contentStorage(sessionId);
    let manifestUpdated = false;

    for (const config of configs) {
      try {
        // Find the page in manifest by vaultPath
        const page = manifest.pages.find((p) => p.vaultPath === config.indexFilePath);

        if (!page) {
          log.warn('Custom index page not found in manifest', {
            indexFilePath: config.indexFilePath,
            availableVaultPaths: manifest.pages.map((p) => p.vaultPath),
          });
          continue;
        }

        log.debug('Found custom index page in manifest', {
          indexFilePath: config.indexFilePath,
          pageId: page.id,
          route: page.route,
          slug: page.slug.value,
        });

        // Read the generated HTML content using the route (which should match the file path)
        // The file is saved as: [...folders, slug.html]
        const htmlContent = await contentPort.read(page.route);

        if (!htmlContent) {
          log.warn('Custom index HTML not found', {
            indexFilePath: config.indexFilePath,
            route: page.route,
          });
          continue;
        }

        log.debug('Read HTML content', {
          route: page.route,
          htmlLength: htmlContent.length,
          htmlPreview: htmlContent.substring(0, 200),
        });

        // Inject rendered Dataview and Leaflet blocks before extracting
        const htmlWithBlocks = this.injectRenderedBlocks(htmlContent, page);

        // Extract body content from full HTML page
        let bodyContent = this.extractBodyContent(htmlWithBlocks);

        // Remove the first H1 title for ALL custom indexes (auto-generated from filename)
        // This applies to root index AND folder indexes
        bodyContent = this.removeFirstH1(bodyContent);
        log.debug('Removed first H1 from custom index', {
          folderPath: config.folderPath,
          isRootIndex: config.isRootIndex,
        });

        log.debug('Extracted body content', {
          originalLength: htmlContent.length,
          bodyLength: bodyContent.length,
          bodyPreview: bodyContent.substring(0, 200),
        });

        // Store by folder path (empty string for root becomes '/')
        const key = config.folderPath || '/';
        result.set(key, bodyContent);

        // Instead of removing the page, update its route to be the index route
        // so the ViewerComponent can find it and inject Leaflet/Dataview blocks
        const indexRoute = config.folderPath ? `${config.folderPath}/index` : '/index';
        page.route = indexRoute;
        page.slug = { value: 'index' };
        page.isCustomIndex = true; // Mark to exclude from vault explorer
        manifestUpdated = true;

        log.debug('Custom index page route updated', {
          folderPath: config.folderPath,
          key,
          newRoute: page.route,
          htmlLength: bodyContent.length,
        });
      } catch (error) {
        log.error('Failed to extract custom index HTML', {
          config,
          error,
        });
      }
    }

    // Save manifest with updated routes
    if (manifestUpdated) {
      await manifestPort.save(manifest);
      log.debug('Updated custom index page routes in manifest');
    }

    return result;
  }

  /**
   * Extract body content from full HTML page
   * Removes the HTML structure, keeping only the markdown-body div content
   */
  private extractBodyContent(fullHtml: string): string {
    // Find the opening tag
    const startPattern = /<div class="markdown-body">/;
    const startMatch = fullHtml.match(startPattern);

    if (!startMatch) {
      return fullHtml; // Fallback if pattern not found
    }

    const startIndex = startMatch.index! + startMatch[0].length;

    // Count nested divs to find the matching closing tag
    let depth = 1;
    let i = startIndex;

    while (i < fullHtml.length && depth > 0) {
      if (fullHtml.substring(i, i + 5) === '<div ') {
        depth++;
        i += 5;
      } else if (fullHtml.substring(i, i + 6) === '</div>') {
        depth--;
        if (depth === 0) {
          // Found the matching closing tag
          return fullHtml.substring(startIndex, i).trim();
        }
        i += 6;
      } else {
        i++;
      }
    }

    // Fallback: return everything after the opening tag
    return fullHtml.substring(startIndex).trim();
  }

  /**
   * Remove the first H1 heading from HTML content
   * Used for root index to remove auto-generated title
   */
  private removeFirstH1(html: string): string {
    // Match the first <h1>...</h1> tag and remove it
    const h1Pattern = /<h1[^>]*>.*?<\/h1>/i;
    return html.replace(h1Pattern, '').trim();
  }

  /**
   * Enrich Leaflet block placeholders with full block data
   * Dataview blocks are left as-is (placeholders) for client-side injection
   */
  private injectRenderedBlocks(
    html: string,
    page: { dataviewBlocks?: unknown[]; leafletBlocks?: unknown[] }
  ): string {
    let result = html;

    // For Dataview: Keep placeholders as-is, ViewerComponent will inject them client-side
    // No modification needed - the HTML already contains the placeholders

    // For Leaflet: Enrich placeholders with full block data for client-side rendering
    if (page.leafletBlocks && Array.isArray(page.leafletBlocks)) {
      for (const block of page.leafletBlocks) {
        if (block && typeof block === 'object' && 'id' in block) {
          const blockId = String(block.id);
          // Serialize block data as JSON and embed in data attribute
          const blockDataJson = JSON.stringify(block)
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

          const placeholder = `<div class="leaflet-map-placeholder" data-leaflet-map-id="${blockId}"></div>`;
          const enhancedPlaceholder = `<div class="leaflet-map-placeholder" data-leaflet-map-id="${blockId}" data-leaflet-block='${blockDataJson}'></div>`;
          result = result.replace(placeholder, enhancedPlaceholder);
        }
      }
    }

    return result;
  }

  /**
   * Convert markdown links to .md files into wikilink syntax.
   * [text](file.md) → [[file|text]]
   * [text](file.md#section) → [[file#section|text]]
   */
  private convertMarkdownLinksToWikilinks(content: string): string {
    const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)]+\.md(?:#[^)]*)?)\)/gi;
    return content.replace(MARKDOWN_LINK_REGEX, (match, text, href) => {
      // Skip external URLs
      if (/^https?:\/\//i.test(href)) {
        return match;
      }

      // Remove .md extension
      const target = href.replace(/\.md$/i, '');

      // Convert to wikilink: [[target|text]]
      return `[[${target}|${text}]]`;
    });
  }

  private async resetContentStage(contentStage: string, log: LoggerPort) {
    await fs.rm(contentStage, { recursive: true, force: true });
    await fs.mkdir(contentStage, { recursive: true });
    log.debug('Content staging directory reset', { contentStage });

    // Make sure the raw notes folder exists so we can re-use it when needed.
    const rawDir = path.join(contentStage, '_raw-notes');
    await fs.mkdir(rawDir, { recursive: true });
  }

  private async rebuildContentSearchIndex(sessionId: string): Promise<void> {
    const manifestPort = this.manifestStorage(sessionId);
    const manifest = await manifestPort.load();
    if (!manifest) {
      this.logger.warn('No manifest found after rebuild; skipping search index', { sessionId });
      return;
    }

    try {
      const indexer = new ContentSearchIndexer(
        this.stagingManager.contentStagingPath(sessionId),
        this.logger
      );
      await indexer.build(manifest);
      this.logger.debug('Content search index rebuilt', { sessionId });
    } catch (error) {
      this.logger.warn('Failed to rebuild content search index', { sessionId, error });
    }
  }
}
