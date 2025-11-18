import type { Note } from '../../domain/entities/Note';
import { LoggerPort } from '../ports/LoggerPort';
import type { MarkdownRendererPort } from '../ports/MarkdownRendererPort';
import type { Manifest, ManifestPage, NotesIndexPort } from '../ports/NotesIndexPort';
import type { StoragePort } from '../ports/StoragePort';

export interface PublishNotesOutput {
  published: number;
  errors: { noteId: string; message: string }[];
}

export class UploadNotesUseCase {
  constructor(
    private readonly markdownRenderer: MarkdownRendererPort,
    private readonly contentStorage: StoragePort,
    private readonly siteIndex: NotesIndexPort,
    private readonly logger?: LoggerPort
  ) {
    logger = logger?.child({ module: 'PublishNotesUseCase' });
  }

  async execute(notes: Note[]): Promise<PublishNotesOutput> {
    const logger = this.logger?.child({ method: 'execute' });

    let published = 0;
    const errors: { noteId: string; message: string }[] = [];
    const succeeded: Note[] = [];

    logger?.info(`Starting publishing of ${notes.length} notes`);

    for (const note of notes) {
      const noteLogger = logger?.child({ noteId: note.id, slug: note.slug });
      try {
        noteLogger?.debug('Rendering markdown');
        const bodyHtml = await this.markdownRenderer.render(note.markdown);
        noteLogger?.debug('Building HTML page');
        const fullHtml = this.buildHtmlPage(note, bodyHtml);

        noteLogger?.debug('Saving content to storage', { route: note.route });
        await this.contentStorage.save({
          route: note.route,
          content: fullHtml,
          slug: note.slug,
        });

        published++;
        succeeded.push(note);
        noteLogger?.info('Note published successfully', { route: note.route });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ noteId: note.id, message });
        noteLogger?.error('Failed to publish note', { error: message });
      }
    }

    if (succeeded.length > 0) {
      logger?.info(`Updating site manifest and indexes for ${succeeded.length} published notes`);
      const pages: ManifestPage[] = succeeded.map((n) => {
        return {
          id: n.id,
          title: n.title,
          route: n.route,
          slug: n.slug,
          vaultPath: n.vaultPath,
          relativePath: n.relativePath,
          publishedAt: n.publishedAt,
        };
      });
      pages.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
      logger?.debug('Manifest pages ', { manifestPages: pages });

      const manifest: Manifest = { pages };
      await this.siteIndex.save(manifest);
      await this.siteIndex.rebuildIndex(manifest);
      logger?.info('Site manifest and indexes updated');
    }

    logger?.info(`Publishing complete: ${published} notes published, ${errors.length} errors`);
    if (errors.length > 0) {
      logger?.warn('Some notes failed to publish', { errors });
    }

    return { published, errors };
  }

  private buildHtmlPage(note: Note, bodyHtml: string): string {
    return `
  <div class="markdown-body">
    ${bodyHtml}
  </div>`;
  }
}
