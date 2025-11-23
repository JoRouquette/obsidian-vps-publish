import { ContentStoragePort } from '../ports/ContentStoragePort';
import { LoggerPort } from '../../ports/LoggerPort';
import type { MarkdownRendererPort } from '../../ports/MarkdownRendererPort';
import type { ManifestPort } from '../ports/ManifestStoragePort';
import { PublishableNote } from '../../../domain/entities/Note';
import { ManifestPage } from '../../../domain/entities/ManifestPage';
import { Manifest } from '../../../domain/entities/Manifest';
import { CommandHandler } from '../../common/CommandHandler';
import { UploadNotesCommand, UploadNotesResult } from '../commands/UploadNotesCommand';

export interface PublishNotesOutput {
  published: number;
  errors: { noteId: string; message: string }[];
}

export class UploadNotesHandler implements CommandHandler<UploadNotesCommand, UploadNotesResult> {
  private readonly logger?: LoggerPort;

  constructor(
    private readonly markdownRenderer: MarkdownRendererPort,
    private readonly contentStorage: ContentStoragePort,
    private readonly manifestStorage: ManifestPort,
    logger?: LoggerPort
  ) {
    this.logger = logger?.child({ handler: 'UploadNotesHandler' });
  }

  async handle(command: UploadNotesCommand): Promise<UploadNotesResult> {
    const { sessionId, notes } = command;
    const logger = this.logger?.child({ method: 'handle', sessionId });

    let published = 0;
    const errors: { noteId: string; message: string }[] = [];
    const succeeded: PublishableNote[] = [];

    logger?.info(`Starting publishing of ${notes.length} notes`);

    for (const note of notes) {
      const noteLogger = logger?.child({ noteId: note.noteId, slug: note.routing?.slug });
      try {
        noteLogger?.debug('Rendering markdown');
        const bodyHtml = await this.markdownRenderer.render(note.content);
        noteLogger?.debug('Building HTML page');
        const fullHtml = this.buildHtmlPage(note, bodyHtml);

        noteLogger?.debug('Saving content to storage', { route: note.routing?.routeBase });
        await this.contentStorage.save({
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
        slug: n.routing.slug,
        publishedAt: n.publishedAt,
        vaultPath: n.vaultPath,
        relativePath: n.relativePath,
        tags: n.frontmatter?.tags ?? [],
      }));

      pages.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
      logger?.debug('Session manifest pages for batch', {
        sessionId,
        manifestPages: pages.map((p) => ({ id: p.id, route: p.route })),
      });

      await this.updateManifestForSession(sessionId, pages, logger);
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
    logger?: LoggerPort
  ): Promise<void> {
    const existing = await this.manifestStorage.load();
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

    await this.manifestStorage.save(manifest);
    await this.manifestStorage.rebuildIndex(manifest);
    logger?.info('Site manifest and indexes updated', {
      sessionId,
      pageCount: manifest.pages.length,
    });
  }

  private buildHtmlPage(note: PublishableNote, bodyHtml: string): string {
    return `
  <div class="markdown-body">
    ${bodyHtml}
  </div>`;
  }
}
