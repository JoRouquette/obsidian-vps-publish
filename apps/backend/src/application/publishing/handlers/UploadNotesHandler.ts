import { ContentStoragePort } from '../ports/ContentStoragePort';
import { LoggerPort } from '../../ports/LoggerPort';
import type { MarkdownRendererPort } from '../../ports/MarkdownRendererPort';
import type { Manifest, ManifestPage, NotesIndexPort } from '../ports/NotesIndexPort';
import { PublishableNote } from '../../../domain/entities/Note';

export interface PublishNotesOutput {
  published: number;
  errors: { noteId: string; message: string }[];
}

export class UploadNotesHandler {
  constructor(
    private readonly markdownRenderer: MarkdownRendererPort,
    private readonly contentStorage: ContentStoragePort,
    private readonly notesIndex: NotesIndexPort,
    private readonly logger?: LoggerPort
  ) {
    logger = logger?.child({ handler: 'UploadNotesHandler' });
  }

  async handle(notes: PublishableNote[]): Promise<PublishNotesOutput> {
    const logger = this.logger?.child({ method: 'execute' });

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
      logger?.info(`Updating site manifest and indexes for ${succeeded.length} published notes`);
      const pages: ManifestPage[] = succeeded.map((n) => {
        return {
          id: n.noteId,
          title: n.title,
          route: n.routing.fullPath,
          slug: n.routing.slug,
          vaultPath: n.vaultPath,
          relativePath: n.relativePath,
          publishedAt: n.publishedAt,
        };
      });
      pages.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
      logger?.debug('Manifest pages ', { manifestPages: pages });

      const manifest: Manifest = { pages };
      await this.notesIndex.save(manifest);
      await this.notesIndex.rebuildIndex(manifest);
      logger?.info('Site manifest and indexes updated');
    }

    logger?.info(`Publishing complete: ${published} notes published, ${errors.length} errors`);
    if (errors.length > 0) {
      logger?.warn('Some notes failed to publish', { errors });
    }

    return { published, errors };
  }

  private buildHtmlPage(note: PublishableNote, bodyHtml: string): string {
    return `
  <div class="markdown-body">
    ${bodyHtml}
  </div>`;
  }
}
