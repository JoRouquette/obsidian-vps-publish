import { Manifest, ManifestPage, PublishableNote, Slug } from '@core-domain';
import { CommandHandler } from '../../common/command-handler';
import { LoggerPort } from '../../ports/logger.port';
import type { MarkdownRendererPort } from '../../ports/markdown-renderer.port';
import { UploadNotesCommand, UploadNotesResult } from '../commands/upload-notes.command';
import { ContentStoragePort } from '../ports/content-storage.port';
import type { ManifestPort } from '../ports/manifest-storage.port';

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
    logger?: LoggerPort
  ) {
    this.logger = logger?.child({ handler: 'UploadNotesHandler' });
  }

  async handle(command: UploadNotesCommand): Promise<UploadNotesResult> {
    const { sessionId, notes } = command;
    const contentStorage = this.resolveContentStorage(sessionId);
    const manifestStorage = this.resolveManifestStorage(sessionId);
    const logger = this.logger?.child({ method: 'handle', sessionId });

    let published = 0;
    const errors: { noteId: string; message: string }[] = [];
    const succeeded: PublishableNote[] = [];

    logger?.info(`Starting publishing of ${notes.length} notes`);

    for (const note of notes) {
      const noteLogger = logger?.child({ noteId: note.noteId, slug: note.routing?.slug });
      try {
        noteLogger?.debug('Rendering markdown');
        const bodyHtml = await this.markdownRenderer.render(note);
        noteLogger?.debug('Building HTML page');
        const fullHtml = this.buildHtmlPage(note, bodyHtml);

        noteLogger?.debug('Saving content to storage', { route: note.routing?.routeBase });
        await contentStorage.save({
          route: note.routing.fullPath,
          content: fullHtml,
          slug: note.routing.slug,
        });

        published++;
        succeeded.push(note);
        noteLogger?.info('Note published successfully', { route: note.routing?.routeBase });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ noteId: note.noteId, message });
        noteLogger?.error('Failed to publish note', { error: message });
      }
    }

    if (succeeded.length > 0) {
      const pages: ManifestPage[] = succeeded.map((n) => ({
        id: n.noteId,
        title: n.title,
        route: n.routing.fullPath,
        slug: Slug.from(n.routing.slug),
        publishedAt: n.publishedAt,
        vaultPath: n.vaultPath,
        relativePath: n.relativePath,
        tags: n.frontmatter.tags ?? [],
      }));

      pages.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
      logger?.debug('Session manifest pages for batch', {
        sessionId,
        manifestPages: pages.map((p) => ({ id: p.id, route: p.route })),
      });

      await this.updateManifestForSession(sessionId, pages, manifestStorage, logger);
    }

    logger?.info(`Publishing complete: ${published} notes published, ${errors.length} errors`);
    if (errors.length > 0) {
      logger?.warn('Some notes failed to publish', { errors });
    }

    return { sessionId, published, errors };
  }

  private async updateManifestForSession(
    sessionId: string,
    newPages: ManifestPage[],
    manifestStorage: ManifestPort,
    logger?: LoggerPort
  ): Promise<void> {
    const existing = await manifestStorage.load();
    const now = new Date();

    let manifest: Manifest;

    // Si pas de manifest ou manifest lié à une autre session → on repars de zéro
    if (!existing || existing.sessionId !== sessionId) {
      logger?.info('Starting new manifest for session', { sessionId });
      manifest = {
        sessionId,
        createdAt: now,
        lastUpdatedAt: now,
        pages: [],
      };
    } else {
      manifest = {
        ...existing,
        lastUpdatedAt: now,
      };
    }

    // Merge : dernière version d'une note gagne
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

    await manifestStorage.save(manifest);
    await manifestStorage.rebuildIndex(manifest);
    logger?.info('Site manifest and indexes updated', {
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

    const entries: Array<{ key: string; value: unknown }> = [];
    for (const [k, v] of Object.entries(fm)) {
      entries.push({ key: k, value: v });
    }
    if (tags.length > 0 && !('tags' in fm)) {
      entries.push({ key: 'tags', value: tags });
    }

    if (entries.length === 0) return '';

    const renderValue = (value: unknown, depth: number): string => {
      if (value === null || value === undefined) return '<span class="fm-value is-empty">—</span>';
      if (typeof value === 'boolean') {
        const checked = value ? 'checked' : '';
        return `<label class="fm-boolean"><input type="checkbox" disabled ${checked}>${value ? 'Oui' : 'Non'}</label>`;
      }
      if (Array.isArray(value)) {
        const csv = value
          .map((v) => (typeof v === 'string' ? v : String(v ?? '')))
          .filter((v) => v.length > 0)
          .join(', ');
        return `<span class="fm-value">${csv}</span>`;
      }
      if (typeof value === 'object') {
        const rows = Object.entries(value as Record<string, unknown>)
          .map(([ck, cv]) => renderEntry(ck, cv, depth + 1))
          .join('');
        return `<div class="fm-group depth-${depth}">${rows}</div>`;
      }
      return `<span class="fm-value">${String(value)}</span>`;
    };

    const renderEntry = (key: string, value: unknown, depth: number): string => {
      return `
      <div class="fm-row depth-${depth}">
        <span class="fm-label">${key}</span>
        <span class="fm-sep">:</span>
        ${renderValue(value, depth)}
      </div>`;
    };

    const rows = entries
      .sort((a, b) => a.key.localeCompare(b.key, 'fr', { sensitivity: 'base' }))
      .map((e) => renderEntry(e.key, e.value, 0))
      .join('');
    return `<section class="frontmatter-card">
      <div class="fm-title">Frontmatter</div>
      <div class="fm-grid">
        ${rows}
      </div>
    </section>`;
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
}
