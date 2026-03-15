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
import { NoteHashService } from '@core-application/publishing/services/note-hash.service';
import {
  type CustomIndexConfig,
  type LeafletBlock,
  type LoggerPort,
  LogLevel,
  type Manifest,
} from '@core-domain';
import { load } from 'cheerio';

import { type StagingManager } from '../filesystem/staging-manager';
import { ContentSearchIndexer } from '../search/content-search-indexer';
import { SlugChangeDetectorService } from './slug-change-detector.service';
import { ValidateLinksService } from './validate-links.service';

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

  async rebuildFromStored(sessionId: string): Promise<Map<string, string> | undefined> {
    const startTime = performance.now();
    const log = this.logger.child({ sessionId });
    const timings: Record<string, number> = {};

    // STEP 0: Load raw notes
    let stepStart = performance.now();
    const rawNotes = await this.notesStorage.loadAll(sessionId);
    timings.loadRawNotes = performance.now() - stepStart;

    if (rawNotes.length === 0) {
      log.warn('No raw notes found for session; skipping rebuild');
      return undefined;
    }

    log.debug('Rebuilding session content from stored notes', { count: rawNotes.length });

    // STEP 1: Load session metadata
    stepStart = performance.now();
    const session = await this.sessionRepository.findById(sessionId);
    const customIndexConfigs = session?.customIndexConfigs ?? [];
    const folderDisplayNames = session?.folderDisplayNames ?? {};
    timings.loadSessionMetadata = performance.now() - stepStart;
    log.debug('Loaded session metadata', {
      customIndexConfigsCount: customIndexConfigs.length,
      folderDisplayNamesCount: Object.keys(folderDisplayNames).length,
      folderDisplayNames,
    });

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

    // STEP 5: Compute routing first, then resolve wikilinks
    // IMPORTANT: routing must be calculated BEFORE wikilink resolution,
    // because ResolveWikilinksService checks if targetNote.routing is defined
    // to determine if a wikilink is resolved (line 51: isResolved = !!targetNote && targetNote.routing !== undefined)
    stepStart = performance.now();
    const computeRouting = new ComputeRoutingService(this.logger);
    const detect = new DetectWikilinksService(this.logger);
    const resolve = new ResolveWikilinksService(this.logger, detect);

    const routed = computeRouting.process(withConvertedLinks);
    const withLinks = resolve.process(routed);
    timings.resolveWikilinksAndRouting = performance.now() - stepStart;

    // STEP 7: Reset content staging directory
    stepStart = performance.now();
    const contentStage = this.stagingManager.contentStagingPath(sessionId);
    await this.resetContentStage(contentStage, log);
    timings.resetContentStage = performance.now() - stepStart;

    // STEP 8: Render markdown to HTML
    stepStart = performance.now();
    const noteHashService = new NoteHashService();
    const renderer = new UploadNotesHandler(
      this.markdownRenderer,
      this.contentStorage,
      this.manifestStorage,
      this.logger,
      undefined, // notesStorage not needed here
      session?.ignoredTags, // Pass ignoredTags from session
      noteHashService
    );

    // Publier toutes les notes avec folderDisplayNames
    await renderer.handle({
      sessionId,
      notes: withLinks, // Use withLinks (has routing + resolved wikilinks)
      folderDisplayNames, // Pass folderDisplayNames from session
    });
    timings.renderMarkdownToHtml = performance.now() - stepStart;

    // STEP 8.5: Replace asset paths if any images were converted (e.g., .png → .webp)
    if (session?.assetPathMappings && Object.keys(session.assetPathMappings).length > 0) {
      stepStart = performance.now();
      const contentRoot = this.stagingManager.contentStagingPath(sessionId);
      const replacedCount = await this.replaceAssetPaths(
        contentRoot,
        session.assetPathMappings,
        log
      );
      timings.replaceAssetPaths = performance.now() - stepStart;
      log.info('Asset paths replaced in HTML files', {
        mappingsCount: Object.keys(session.assetPathMappings).length,
        filesModified: replacedCount,
        durationMs: timings.replaceAssetPaths.toFixed(2),
      });

      // STEP 8.6: Update manifest pages with optimized asset paths
      stepStart = performance.now();
      const manifestForAssets = this.manifestStorage(sessionId);
      const currentManifest = await manifestForAssets.load();
      if (currentManifest) {
        const updateResult = this.replaceAssetPathsInManifestPages(
          currentManifest,
          session.assetPathMappings,
          log
        );
        if (updateResult.modified) {
          await manifestForAssets.save(currentManifest);
          log.info('Asset paths replaced in manifest pages', {
            pagesModified: updateResult.pagesModified,
            coverImagesUpdated: updateResult.coverImagesUpdated,
            leafletOverlaysUpdated: updateResult.leafletOverlaysUpdated,
          });
        }
      }
      timings.replaceManifestAssetPaths = performance.now() - stepStart;
    }

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

    // STEP 10.6: Detect slug changes and update canonicalMap
    if (manifest) {
      stepStart = performance.now();
      const slugDetector = new SlugChangeDetectorService(this.logger);

      // Charger le manifest de production (s'il existe)
      const productionManifest = await slugDetector.loadProductionManifest(
        this.stagingManager.contentRootPath
      );

      // Détecter les changements de slug et mettre à jour le canonicalMap
      const updatedManifest = await slugDetector.detectAndUpdateCanonicalMap(
        productionManifest,
        manifest
      );

      // Nettoyer les mappings obsolètes
      const cleanedManifest = slugDetector.cleanupCanonicalMap(updatedManifest);

      // Sauvegarder le manifest mis à jour
      await manifestPort.save(cleanedManifest);

      log.debug('Slug changes detected and canonicalMap updated', {
        hasCanonicalMap: !!cleanedManifest.canonicalMap,
        mappingsCount: cleanedManifest.canonicalMap
          ? Object.keys(cleanedManifest.canonicalMap).length
          : 0,
      });

      timings.detectSlugChanges = performance.now() - stepStart;
    }

    // STEP 10.7: Validate and fix all links in HTML files
    if (manifest) {
      stepStart = performance.now();
      const contentRoot = this.stagingManager.contentStagingPath(sessionId);
      const linkValidator = new ValidateLinksService(this.logger);
      const validationResult = await linkValidator.validateAllLinks(contentRoot, manifest);
      timings.validateLinks = performance.now() - stepStart;

      log.info('Link validation completed', {
        filesProcessed: validationResult.filesProcessed,
        filesModified: validationResult.filesModified,
        linksFixed: validationResult.linksFixed,
        durationMs: timings.validateLinks.toFixed(2),
      });
    }

    // NOTE: Search index is now rebuilt AFTER manifest merge in SessionFinalizationJobService
    // This ensures the index includes ALL pages (staging + unchanged production pages)
    // See: session-finalization-job.service.ts executeJob() STEP 3

    // STEP 11: Clear session storage
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

    return customIndexesHtml;
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
        const htmlWithBlocks = this.injectRenderedBlocks(htmlContent, page, log);

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
    page: { dataviewBlocks?: unknown[]; leafletBlocks?: unknown[]; route?: string },
    log: LoggerPort
  ): string {
    // For Dataview: Keep placeholders as-is, ViewerComponent will inject them client-side
    // No modification needed - the HTML already contains the placeholders

    // For Leaflet: Enrich placeholders with full block data for client-side rendering
    if (
      !page.leafletBlocks ||
      !Array.isArray(page.leafletBlocks) ||
      page.leafletBlocks.length === 0
    ) {
      return html;
    }

    const blocksById = new Map<string, unknown>();
    for (const block of page.leafletBlocks) {
      if (!block || typeof block !== 'object' || !('id' in block)) {
        continue;
      }

      const blockId = String(block.id);
      if (blocksById.has(blockId)) {
        log.warn('Duplicate Leaflet block id detected while enriching placeholders', {
          route: page.route,
          blockId,
        });
      }

      blocksById.set(blockId, block);
    }

    if (blocksById.size === 0) {
      return html;
    }

    const $ = (load as (...args: unknown[]) => ReturnType<typeof load>)(
      html,
      { decodeEntities: false },
      false
    );
    const placeholders = $('[data-leaflet-map-id]');

    let enrichedCount = 0;
    let missingBlockCount = 0;

    for (const element of placeholders.toArray()) {
      const mapId = $(element).attr('data-leaflet-map-id');
      if (!mapId) {
        continue;
      }

      const block = blocksById.get(mapId);
      if (!block) {
        missingBlockCount++;
        log.warn('Leaflet placeholder has no matching block data', {
          route: page.route,
          mapId,
        });
        continue;
      }

      const blockDataJson = JSON.stringify(block);
      $(element).attr('data-leaflet-block', blockDataJson);
      enrichedCount++;
    }

    if (enrichedCount === 0 && blocksById.size > 0) {
      log.warn('No Leaflet placeholder was enriched despite available blocks', {
        route: page.route,
        availableBlocks: blocksById.size,
        placeholders: placeholders.length,
      });
    }

    if (placeholders.length > 0 && missingBlockCount > 0) {
      log.warn('Some Leaflet placeholders could not be enriched', {
        route: page.route,
        placeholders: placeholders.length,
        enriched: enrichedCount,
        missing: missingBlockCount,
      });
    }

    return $.html();
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

  /**
   * Replace asset paths in HTML files based on optimization mappings.
   * When images are converted (e.g., .png → .webp), this updates all references in HTML.
   * Also handles Leaflet blocks where image paths are stored in JSON data attributes.
   * @returns Number of files modified
   */
  private async replaceAssetPaths(
    contentRoot: string,
    mappings: Record<string, string>,
    log: LoggerPort
  ): Promise<number> {
    const htmlFiles: string[] = [];

    // Recursively find all HTML files
    const findHtmlFiles = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await findHtmlFiles(fullPath);
        } else if (entry.name.endsWith('.html')) {
          htmlFiles.push(fullPath);
        }
      }
    };

    await findHtmlFiles(contentRoot);

    if (htmlFiles.length === 0) {
      return 0;
    }

    // Build regex patterns for all mappings
    // Match both encoded and non-encoded paths in src, href, data-src attributes
    const patterns: { pattern: RegExp; replacement: string }[] = [];
    for (const [original, optimized] of Object.entries(mappings)) {
      // Create patterns for common attribute contexts
      // Match: src="...original...", href="...original...", /assets/original
      const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedEncoded = encodeURIComponent(original).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Replace in src, href, data-src attributes
      patterns.push({
        pattern: new RegExp(`(src=["'].*?)${escapedOriginal}(["'])`, 'gi'),
        replacement: `$1${optimized}$2`,
      });
      patterns.push({
        pattern: new RegExp(`(href=["'].*?)${escapedOriginal}(["'])`, 'gi'),
        replacement: `$1${optimized}$2`,
      });
      patterns.push({
        pattern: new RegExp(`(data-src=["'].*?)${escapedOriginal}(["'])`, 'gi'),
        replacement: `$1${optimized}$2`,
      });

      // Also match URL-encoded versions
      if (escapedOriginal !== escapedEncoded) {
        patterns.push({
          pattern: new RegExp(`(src=["'].*?)${escapedEncoded}(["'])`, 'gi'),
          replacement: `$1${encodeURIComponent(optimized)}$2`,
        });
        patterns.push({
          pattern: new RegExp(`(href=["'].*?)${escapedEncoded}(["'])`, 'gi'),
          replacement: `$1${encodeURIComponent(optimized)}$2`,
        });
      }
    }

    let filesModified = 0;

    for (const htmlFile of htmlFiles) {
      let content = await fs.readFile(htmlFile, 'utf-8');
      let modified = false;

      // Replace in standard HTML attributes (src, href, data-src)
      for (const { pattern, replacement } of patterns) {
        const newContent = content.replace(pattern, replacement);
        if (newContent !== content) {
          content = newContent;
          modified = true;
        }
      }

      // Replace in Leaflet block JSON (data-leaflet-block attribute)
      const leafletResult = this.replaceAssetPathsInLeafletBlocks(content, mappings, log);
      if (leafletResult.modified) {
        content = leafletResult.content;
        modified = true;
      }

      if (modified) {
        await fs.writeFile(htmlFile, content, 'utf-8');
        filesModified++;
        log.debug('Replaced asset paths in HTML file', {
          file: path.relative(contentRoot, htmlFile),
        });
      }
    }

    return filesModified;
  }

  /**
   * Replace asset paths in Leaflet block JSON data.
   * Leaflet blocks store image overlay paths in JSON within data-leaflet-block attribute.
   */
  private replaceAssetPathsInLeafletBlocks(
    html: string,
    mappings: Record<string, string>,
    log: LoggerPort
  ): { content: string; modified: boolean } {
    // Quick check to avoid parsing if no Leaflet blocks
    if (!html.includes('data-leaflet-block=')) {
      return { content: html, modified: false };
    }

    const $ = (load as (...args: unknown[]) => ReturnType<typeof load>)(
      html,
      { decodeEntities: false },
      false
    );
    const leafletElements = $('[data-leaflet-block]');

    if (leafletElements.length === 0) {
      return { content: html, modified: false };
    }

    let modified = false;

    for (const element of leafletElements.toArray()) {
      const blockDataJson = $(element).attr('data-leaflet-block');
      if (!blockDataJson) {
        continue;
      }

      try {
        const blockData = JSON.parse(blockDataJson);

        // Replace paths in imageOverlays
        if (blockData.imageOverlays && Array.isArray(blockData.imageOverlays)) {
          for (const overlay of blockData.imageOverlays) {
            if (overlay.path && typeof overlay.path === 'string') {
              // Check for direct match or match with /assets/ prefix
              for (const [original, optimized] of Object.entries(mappings)) {
                // Match exact path or path ending with original
                if (overlay.path === original || overlay.path.endsWith('/' + original)) {
                  const newPath = overlay.path.replace(original, optimized);
                  log.debug('Replacing Leaflet imageOverlay path', {
                    old: overlay.path,
                    new: newPath,
                  });
                  overlay.path = newPath;
                  modified = true;
                  break;
                }
              }
            }
          }
        }

        // Update the attribute with modified JSON
        if (modified) {
          $(element).attr('data-leaflet-block', JSON.stringify(blockData));
        }
      } catch (error) {
        log.warn('Failed to parse Leaflet block JSON for asset path replacement', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { content: $.html(), modified };
  }

  /**
   * Replace asset paths in manifest pages (coverImage and leafletBlocks.imageOverlays.path).
   * This ensures the manifest JSON reflects optimized asset filenames.
   */
  private replaceAssetPathsInManifestPages(
    manifest: Manifest,
    mappings: Record<string, string>,
    log: LoggerPort
  ): {
    modified: boolean;
    pagesModified: number;
    coverImagesUpdated: number;
    leafletOverlaysUpdated: number;
  } {
    let pagesModified = 0;
    let coverImagesUpdated = 0;
    let leafletOverlaysUpdated = 0;

    for (const page of manifest.pages) {
      let pageModified = false;

      // Update coverImage path
      if (page.coverImage) {
        const newCoverImage = this.replaceAssetPath(page.coverImage, mappings);
        if (newCoverImage !== page.coverImage) {
          log.debug('Replacing coverImage path in manifest', {
            route: page.route,
            old: page.coverImage,
            new: newCoverImage,
          });
          page.coverImage = newCoverImage;
          coverImagesUpdated++;
          pageModified = true;
        }
      }

      // Update leafletBlocks imageOverlays paths
      if (page.leafletBlocks && Array.isArray(page.leafletBlocks)) {
        for (const block of page.leafletBlocks as LeafletBlock[]) {
          if (block.imageOverlays && Array.isArray(block.imageOverlays)) {
            for (const overlay of block.imageOverlays) {
              if (overlay.path) {
                const newPath = this.replaceAssetPath(overlay.path, mappings);
                if (newPath !== overlay.path) {
                  log.debug('Replacing Leaflet imageOverlay path in manifest', {
                    route: page.route,
                    blockId: block.id,
                    old: overlay.path,
                    new: newPath,
                  });
                  overlay.path = newPath;
                  leafletOverlaysUpdated++;
                  pageModified = true;
                }
              }
            }
          }
        }
      }

      if (pageModified) {
        pagesModified++;
      }
    }

    return {
      modified: pagesModified > 0,
      pagesModified,
      coverImagesUpdated,
      leafletOverlaysUpdated,
    };
  }

  /**
   * Replace an asset path using the mappings.
   * Handles both exact matches and paths containing the original filename.
   * Skips absolute URLs (http://, https://).
   */
  private replaceAssetPath(assetPath: string, mappings: Record<string, string>): string {
    // Skip absolute URLs
    if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
      return assetPath;
    }

    for (const [original, optimized] of Object.entries(mappings)) {
      // Exact match
      if (assetPath === original) {
        return optimized;
      }
      // Path ends with /original (e.g., /assets/_assets/image.png)
      if (assetPath.endsWith('/' + original)) {
        return assetPath.replace(original, optimized);
      }
      // Path contains /original (e.g., /assets/image.png → /assets/image.webp)
      if (assetPath.includes('/' + original)) {
        return assetPath.replace(original, optimized);
      }
      // Original is a filename that appears at the end
      if (assetPath.endsWith(original)) {
        return assetPath.slice(0, -original.length) + optimized;
      }
    }
    return assetPath;
  }
}
