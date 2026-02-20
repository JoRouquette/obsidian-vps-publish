import {
  type AssetRef,
  type LoggerPort,
  type Manifest,
  type ManifestPage,
  type NoteHashPort,
  type PublishableNote,
  type ResolvedWikilink,
  Slug,
} from '@core-domain';
import { humanizePropertyKey } from '@core-domain/utils/string.utils';

import { type CommandHandler } from '../../common/command-handler';
import type { MarkdownRendererPort } from '../../ports/markdown-renderer.port';
import { type UploadNotesCommand, type UploadNotesResult } from '../commands/upload-notes.command';
import { type ContentStoragePort } from '../ports/content-storage.port';
import type { ManifestPort } from '../ports/manifest-storage.port';
import type { SessionNotesStoragePort } from '../ports/session-notes-storage.port';

export interface PublishNotesOutput {
  published: number;
  errors: { noteId: string; message: string }[];
}

type ContentStorageFactory = (sessionId: string) => ContentStoragePort;
type ManifestStorageFactory = (sessionId: string) => ManifestPort;

export class UploadNotesHandler implements CommandHandler<UploadNotesCommand, UploadNotesResult> {
  private readonly logger?: LoggerPort;

  constructor(
    private readonly markdownRenderer: MarkdownRendererPort,
    private readonly contentStorage: ContentStoragePort | ContentStorageFactory,
    private readonly manifestStorage: ManifestPort | ManifestStorageFactory,
    logger?: LoggerPort,
    private readonly notesStorage?: SessionNotesStoragePort,
    private readonly ignoredTags?: string[],
    private readonly noteHashService?: NoteHashPort
  ) {
    this.logger = logger?.child({ handler: 'UploadNotesHandler' });
  }

  async handle(command: UploadNotesCommand): Promise<UploadNotesResult> {
    const { sessionId, notes, cleanupRules, folderDisplayNames } = command;
    const contentStorage = this.resolveContentStorage(sessionId);
    const manifestStorage = this.resolveManifestStorage(sessionId);
    const logger = this.logger?.child({ method: 'handle', sessionId });

    if (this.notesStorage) {
      try {
        await this.notesStorage.append(sessionId, notes);
        logger?.debug('Session notes persisted for rebuild', { count: notes.length });

        // Save cleanup rules if provided (first upload batch only)
        if (cleanupRules && cleanupRules.length > 0) {
          await this.notesStorage.saveCleanupRules(sessionId, cleanupRules);
          logger?.debug('Session cleanup rules persisted', { count: cleanupRules.length });
        }
      } catch (err) {
        logger?.warn('Failed to persist raw notes for session', { error: err });
      }
    }

    const errors: { noteId: string; message: string }[] = [];
    const succeeded: PublishableNote[] = [];

    logger?.debug(`Starting parallel publishing of ${notes.length} notes (max 10 concurrent)`);

    // Load manifest for vault-to-route path translation
    const manifest = await manifestStorage.load();
    logger?.debug('Manifest loaded for path translation', {
      pagesCount: manifest?.pages.length ?? 0,
    });

    // Process notes in parallel with controlled concurrency
    // Using Promise.allSettled to handle both successes and failures
    const CONCURRENCY = 10;
    const results: PromiseSettledResult<PublishableNote>[] = [];

    for (let i = 0; i < notes.length; i += CONCURRENCY) {
      const batch = notes.slice(i, Math.min(i + CONCURRENCY, notes.length));
      const batchResults = await Promise.allSettled(
        batch.map(async (note) => {
          const noteLogger = logger?.child({ noteId: note.noteId, slug: note.routing?.slug });
          try {
            noteLogger?.debug('Rendering markdown');
            const bodyHtml = await this.markdownRenderer.render(note, {
              ignoredTags: this.ignoredTags,
              manifest: manifest ?? undefined,
            });
            noteLogger?.debug('Building HTML page');
            const fullHtml = this.buildHtmlPage(note, bodyHtml);

            noteLogger?.debug('Saving content to storage', { route: note.routing?.routeBase });
            await contentStorage.save({
              route: note.routing.fullPath,
              content: fullHtml,
              slug: note.routing.slug,
            });

            noteLogger?.debug('Note published successfully', { route: note.routing?.routeBase });
            return note;
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            noteLogger?.error('Failed to publish note', { error: message });
            throw err;
          }
        })
      );
      results.push(...batchResults);
    }

    // Aggregate results
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        succeeded.push(result.value);
      } else {
        const note = notes[idx];
        const message = result.reason instanceof Error ? result.reason.message : 'Unknown error';
        errors.push({ noteId: note.noteId, message });
      }
    });

    const published = succeeded.length;

    if (succeeded.length > 0) {
      // Compute source hashes in parallel if noteHashService is available
      const pages: ManifestPage[] = await Promise.all(
        succeeded.map(async (n) => {
          try {
            // Compute source hash and size if hash service available
            let sourceHash: string | undefined;
            let sourceSize: number | undefined;

            if (this.noteHashService && n.content) {
              try {
                sourceHash = await this.noteHashService.computeHash(n.content);
                sourceSize = Buffer.byteLength(n.content, 'utf8');
                logger?.debug('Computed source hash for note', {
                  route: n.routing.fullPath,
                  hash: sourceHash,
                  size: sourceSize,
                });
              } catch (hashErr) {
                logger?.warn('Failed to compute source hash for note', {
                  route: n.routing.fullPath,
                  error: hashErr,
                });
              }
            }

            // Extract SEO fields from frontmatter (robust extraction)
            const seoFields = this.extractSeoFields(n, logger);

            return {
              id: n.noteId,
              title: n.title,
              route: n.routing.fullPath,
              slug: Slug.from(n.routing.slug),
              publishedAt: n.publishedAt,
              vaultPath: n.vaultPath,
              relativePath: n.relativePath,
              tags: n.frontmatter.tags ?? [],
              leafletBlocks: n.leafletBlocks,
              sourceHash,
              sourceSize,
              // SEO fields
              ...seoFields,
            };
          } catch (err) {
            logger?.error('Invalid slug for note', {
              noteId: n.noteId,
              title: n.title,
              vaultPath: n.vaultPath,
              slug: n.routing.slug,
              fullPath: n.routing.fullPath,
              error: err instanceof Error ? err.message : 'Unknown error',
            });
            throw new Error(
              `Invalid slug "${n.routing.slug}" for note "${n.vaultPath}": ${err instanceof Error ? err.message : 'Unknown error'}`
            );
          }
        })
      );

      pages.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

      // Log détaillé des leafletBlocks pour debug
      const pagesWithLeaflet = pages.filter((p) => (p.leafletBlocks?.length ?? 0) > 0);
      if (pagesWithLeaflet.length > 0) {
        logger?.debug('Pages with Leaflet blocks in manifest', {
          count: pagesWithLeaflet.length,
          pages: pagesWithLeaflet.map((p) => ({
            title: p.title,
            route: p.route,
            blocksCount: p.leafletBlocks?.length,
            blocks: p.leafletBlocks,
          })),
        });
      }

      logger?.debug('Session manifest pages for batch', {
        sessionId,
        manifestPages: pages.map((p) => ({ id: p.id, route: p.route })),
      });

      await this.updateManifestForSession(
        sessionId,
        pages,
        succeeded,
        manifestStorage,
        logger,
        folderDisplayNames
      );
    }

    logger?.debug(`Publishing complete: ${published} notes published, ${errors.length} errors`);
    if (errors.length > 0) {
      logger?.warn('Some notes failed to publish', { errors });
    }

    return { sessionId, published, errors };
  }

  private async updateManifestForSession(
    sessionId: string,
    newPages: ManifestPage[],
    notes: PublishableNote[],
    manifestStorage: ManifestPort,
    logger?: LoggerPort,
    providedDisplayNames?: Record<string, string>
  ): Promise<void> {
    const existing = await manifestStorage.load();
    const now = new Date();

    let manifest: Manifest;

    // If manifest is missing or belongs to another session, start fresh
    if (!existing || existing.sessionId !== sessionId) {
      logger?.debug('Starting new manifest for session', { sessionId });
      manifest = {
        sessionId,
        createdAt: now,
        lastUpdatedAt: now,
        pages: [],
        folderDisplayNames: providedDisplayNames || {},
      };
    } else {
      manifest = {
        ...existing,
        lastUpdatedAt: now,
        // Merge existing folderDisplayNames with providedDisplayNames (providedDisplayNames takes precedence)
        folderDisplayNames: {
          ...(existing.folderDisplayNames || {}),
          ...(providedDisplayNames || {}),
        },
      };
    }

    // Extract folderDisplayNames from notes' folderConfig
    for (const note of notes) {
      if (note.folderConfig.displayName && note.routing?.routeBase) {
        const routeBase = note.routing.routeBase;
        // Only set if not already present (first note wins for same route)
        if (!manifest.folderDisplayNames![routeBase]) {
          manifest.folderDisplayNames![routeBase] = note.folderConfig.displayName;
        }
      }
    }

    logger?.debug('Extracted folderDisplayNames from notes', {
      count: Object.keys(manifest.folderDisplayNames || {}).length,
      displayNames: manifest.folderDisplayNames,
    });

    // Merge: most recent version of a note wins
    const byId = new Map<string, ManifestPage>();
    for (const p of manifest.pages) {
      byId.set(p.id, p);
    }
    for (const p of newPages) {
      byId.set(p.id, p);
    }

    manifest.pages = Array.from(byId.values()).sort(
      (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
    );

    // Clean up empty folderDisplayNames object (don't save if empty)
    if (manifest.folderDisplayNames && Object.keys(manifest.folderDisplayNames).length === 0) {
      manifest.folderDisplayNames = undefined;
    }

    await manifestStorage.save(manifest);
    await manifestStorage.rebuildIndex(manifest);
    logger?.debug('Site manifest and indexes updated', {
      sessionId,
      pageCount: manifest.pages.length,
    });
  }

  private buildHtmlPage(note: PublishableNote, bodyHtml: string): string {
    const meta = this.renderFrontmatter(note);
    return `
  <div class="markdown-body">
    ${meta}
    ${bodyHtml}
  </div>`;
  }

  private renderFrontmatter(note: PublishableNote): string {
    const fm = note.frontmatter?.nested ?? {};
    const tags = Array.isArray(note.frontmatter?.tags) ? note.frontmatter.tags : [];

    const entries: Array<{ key: string; value: unknown; path: string }> = [];
    for (const [k, v] of Object.entries(fm)) {
      if (!this.hasRenderableFrontmatterValue(v)) continue;
      entries.push({ key: k, value: v, path: k });
    }
    if (tags.length > 0 && !('tags' in fm)) {
      entries.push({ key: 'tags', value: tags, path: 'tags' });
    }

    if (entries.length === 0) return '';

    const renderValue = (value: unknown, depth: number, path: string): string => {
      if (!this.hasRenderableFrontmatterValue(value)) return '';

      if (value === null || value === undefined) return '<span class="fm-value is-empty">""</span>';
      if (typeof value === 'boolean') {
        const checked = value ? 'checked' : '';
        return `<label class="fm-boolean"><input type="checkbox" disabled ${checked}>${value ? 'Oui' : 'Non'}</label>`;
      }
      if (Array.isArray(value)) {
        const rendered = value
          .map((v, idx) => renderValue(v, depth + 1, `${path}[${idx}]`))
          .filter((v): v is string => Boolean(v))
          .join('<span class="fm-array-sep">, </span>');

        if (rendered.length === 0) return '';
        return `<div class="fm-array">${rendered}</div>`;
      }
      if (typeof value === 'object') {
        const rows = Object.entries(value as Record<string, unknown>)
          .map(([ck, cv]) => renderEntry(ck, cv, depth + 1, path ? `${path}.${ck}` : ck))
          .filter((v): v is string => Boolean(v))
          .join('');

        if (rows.length === 0) return '';
        return `<div class="fm-group depth-${depth}">${rows}</div>`;
      }
      const renderedText =
        typeof value === 'string'
          ? this.renderFrontmatterText(value, note, path)
          : this.escapeHtml(String(value));
      return `<span class="fm-value">${renderedText}</span>`;
    };

    const renderEntry = (key: string, value: unknown, depth: number, path: string): string => {
      if (!this.hasRenderableFrontmatterValue(value)) return '';
      const label = humanizePropertyKey(key) || key;
      return `
      <div class="fm-row depth-${depth}">
        <span class="fm-label">${this.escapeHtml(label)}</span>
        <span class="fm-sep">:</span>
        ${renderValue(value, depth, path)}
      </div>`;
    };

    const rows = entries
      .sort((a, b) => a.key.localeCompare(b.key, 'fr', { sensitivity: 'base' }))
      .map((e) => renderEntry(e.key, e.value, 0, e.path))
      .filter((v): v is string => Boolean(v))
      .join('');

    if (!rows) return '';

    return `<details class="frontmatter-card">
      <summary class="fm-title">Propriétés</summary>
      <div class="fm-grid">
        ${rows}
      </div>
    </details>`;
  }

  private hasRenderableFrontmatterValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.some((item) => this.hasRenderableFrontmatterValue(item));
    if (typeof value === 'object') {
      return Object.values(value as Record<string, unknown>).some((v) =>
        this.hasRenderableFrontmatterValue(v)
      );
    }
    return true;
  }

  private resolveContentStorage(sessionId: string): ContentStoragePort {
    if (typeof this.contentStorage === 'function') {
      return (this.contentStorage as ContentStorageFactory)(sessionId);
    }
    return this.contentStorage;
  }

  private resolveManifestStorage(sessionId: string): ManifestPort {
    if (typeof this.manifestStorage === 'function') {
      return (this.manifestStorage as ManifestStorageFactory)(sessionId);
    }
    return this.manifestStorage;
  }

  private renderFrontmatterText(text: string, note: PublishableNote, path: string): string {
    const tokensRegex = /(!?\[\[[^\]]+\]\])/g;
    const assets = (note.assets ?? []).filter(
      (a) =>
        (a.origin === 'frontmatter' || !a.origin) &&
        (!a.frontmatterPath || a.frontmatterPath === path)
    );
    const wikilinks = (note.resolvedWikilinks ?? []).filter(
      (l) =>
        (l.origin === 'frontmatter' || !l.origin) &&
        (!l.frontmatterPath || l.frontmatterPath === path)
    );

    let lastIndex = 0;
    const parts: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = tokensRegex.exec(text)) !== null) {
      const idx = match.index ?? 0;
      if (idx > lastIndex) {
        parts.push(this.escapeHtml(text.slice(lastIndex, idx)));
      }

      const raw = match[0];
      if (raw.startsWith('!')) {
        parts.push(this.renderFrontmatterAssetLink(raw, assets));
      } else {
        parts.push(this.renderFrontmatterWikilink(raw, wikilinks));
      }

      lastIndex = idx + raw.length;
    }

    if (lastIndex < text.length) {
      parts.push(this.escapeHtml(text.slice(lastIndex)));
    }

    return parts.join('');
  }

  private renderFrontmatterAssetLink(raw: string, assets: AssetRef[]): string {
    const asset = assets.find((a) => a.raw === raw);
    const target = asset?.target ?? this.extractEmbedTarget(raw);

    if (!target) {
      return this.escapeHtml(raw);
    }

    const href = this.buildAssetUrl(target);
    const label = this.escapeHtml(target);

    return `<a class="fm-link fm-asset-link" href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  }

  private renderFrontmatterWikilink(raw: string, wikilinks: ResolvedWikilink[]): string {
    const link = wikilinks.find((l) => l.raw === raw);
    if (!link) {
      return this.escapeHtml(raw);
    }

    const label = this.escapeHtml(
      link.alias ?? (link.subpath ? `${link.target}#${link.subpath}` : link.target)
    );

    if (link.isResolved) {
      const hrefTarget = link.href ?? link.path ?? link.target;
      const href = this.escapeAttribute(encodeURI(hrefTarget));
      return `<a class="fm-link fm-wikilink" href="${href}">${label}</a>`;
    }

    return `<span class="fm-value fm-wikilink-unresolved">${label}</span>`;
  }

  private extractEmbedTarget(raw: string): string | null {
    const match = raw.match(/!\[\[([^\]]+)\]\]/);
    if (!match) return null;
    const inner = match[1].trim();
    if (!inner) return null;
    const [first] = inner
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);
    return first || null;
  }

  private buildAssetUrl(target: string): string {
    const normalized = target.replace(/^\/+/, '').replace(/^assets\//, '');
    return `/assets/${encodeURI(normalized)}`;
  }

  private escapeHtml(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private escapeAttribute(input: string): string {
    return this.escapeHtml(input).replace(/`/g, '&#96;');
  }

  /**
   * Extract SEO-related fields from note frontmatter.
   * Robust extraction: missing/invalid fields return undefined, never throws.
   */
  private extractSeoFields(
    note: PublishableNote,
    logger?: LoggerPort
  ): {
    description?: string;
    coverImage?: string;
    noIndex?: boolean;
    canonicalSlug?: string;
    lastModifiedAt?: Date;
    isCustomIndex?: boolean;
  } {
    const flat = note.frontmatter.flat ?? {};
    const result: {
      description?: string;
      coverImage?: string;
      noIndex?: boolean;
      canonicalSlug?: string;
      lastModifiedAt?: Date;
      isCustomIndex?: boolean;
    } = {};

    try {
      // Description: string, max ~160 chars (trimmed intelligently)
      const rawDesc = flat['description'] ?? flat['desc'] ?? flat['summary'];
      if (typeof rawDesc === 'string' && rawDesc.trim()) {
        result.description = this.trimDescription(rawDesc.trim());
      }

      // Cover image: resolve to public URL path
      const rawCover = flat['coverimage'] ?? flat['cover'] ?? flat['image'] ?? flat['thumbnail'];
      if (typeof rawCover === 'string' && rawCover.trim()) {
        result.coverImage = this.resolveImagePath(rawCover.trim());
      }

      // noIndex: boolean - page should not be indexed by search engines
      const rawNoIndex = flat['noindex'] ?? flat['draft'] ?? flat['private'];
      if (rawNoIndex === true || rawNoIndex === 'true') {
        result.noIndex = true;
      } else if (rawNoIndex === false || rawNoIndex === 'false') {
        result.noIndex = false;
      }

      // canonicalSlug: for redirect management when slug changes
      const rawCanonical = flat['canonicalslug'] ?? flat['canonical'] ?? flat['alias'];
      if (typeof rawCanonical === 'string' && rawCanonical.trim()) {
        result.canonicalSlug = rawCanonical.trim();
      } else if (Array.isArray(rawCanonical) && rawCanonical.length > 0) {
        // If alias is an array (common in Obsidian), take the first one
        const first = rawCanonical[0];
        if (typeof first === 'string' && first.trim()) {
          result.canonicalSlug = first.trim();
        }
      }

      // lastModifiedAt: from frontmatter or use publishedAt
      const rawModified =
        flat['lastmodified'] ?? flat['lastmodifiedat'] ?? flat['updated'] ?? flat['modified'];
      if (rawModified) {
        const date = this.parseDate(rawModified);
        if (date) {
          result.lastModifiedAt = date;
        }
      }

      // isCustomIndex: detect index files that serve as folder pages
      if (note.vaultPath) {
        const filename = note.vaultPath.split('/').pop() ?? '';
        const basename = filename.replace(/\.md$/i, '').toLowerCase();
        if (basename === 'index' || basename === '_index' || basename === 'readme') {
          result.isCustomIndex = true;
        }
      }

      logger?.debug('Extracted SEO fields from frontmatter', {
        noteId: note.noteId,
        route: note.routing.fullPath,
        hasDescription: !!result.description,
        hasCoverImage: !!result.coverImage,
        noIndex: result.noIndex,
        hasCanonicalSlug: !!result.canonicalSlug,
        hasLastModified: !!result.lastModifiedAt,
        isCustomIndex: result.isCustomIndex,
      });
    } catch (err) {
      logger?.warn('Failed to extract SEO fields from frontmatter', {
        noteId: note.noteId,
        route: note.routing.fullPath,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return result;
  }

  /**
   * Trim description to ~160 chars intelligently (at word boundary).
   */
  private trimDescription(text: string): string {
    const MAX_LENGTH = 160;
    if (text.length <= MAX_LENGTH) {
      return text;
    }

    // Find last space before MAX_LENGTH
    const truncated = text.slice(0, MAX_LENGTH);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > MAX_LENGTH * 0.6) {
      // Cut at word boundary if reasonable
      return truncated.slice(0, lastSpace) + '...';
    }

    // Otherwise just truncate
    return truncated.slice(0, MAX_LENGTH - 3) + '...';
  }

  /**
   * Resolve image path to public URL.
   */
  private resolveImagePath(path: string): string {
    // Already absolute URL
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    // Clean up path
    let cleaned = path.replace(/^!\[\[/, '').replace(/\]\]$/, ''); // Remove ![[...]] wrapper
    cleaned = cleaned.split('|')[0].trim(); // Remove alias part

    // Ensure proper path format for assets
    if (!cleaned.startsWith('/')) {
      cleaned = '/' + cleaned;
    }

    // If not already in /assets/, prepend it
    if (!cleaned.startsWith('/assets/')) {
      // Check if it looks like a relative asset path
      if (cleaned.match(/\.(png|jpg|jpeg|gif|webp|svg|avif)$/i) && !cleaned.includes('/content/')) {
        cleaned = '/assets' + cleaned;
      }
    }

    return cleaned;
  }

  /**
   * Parse various date formats to Date object.
   */
  private parseDate(value: unknown): Date | null {
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }
    return null;
  }
}
