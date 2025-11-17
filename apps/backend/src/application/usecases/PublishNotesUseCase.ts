import type { Note } from '../../domain/entities/Note';
import { LoggerPort } from '../ports/LoggerPort';
import type { MarkdownRendererPort } from '../ports/MarkdownRendererPort';
import type { Manifest, ManifestPage, SiteIndexPort } from '../ports/SiteIndexPort';
import type { StoragePort } from '../ports/StoragePort';

export interface PublishNotesInput {
  notes: Note[];
}

export interface PublishNotesOutput {
  published: number;
  errors: { noteId: string; message: string }[];
}

export class PublishNotesUseCase {
  constructor(
    private readonly markdownRenderer: MarkdownRendererPort,
    private readonly contentStorage: StoragePort,
    private readonly siteIndex: SiteIndexPort,
    private readonly logger?: LoggerPort
  ) {}

  async execute(input: PublishNotesInput): Promise<PublishNotesOutput> {
    let published = 0;
    const errors: { noteId: string; message: string }[] = [];
    const succeeded: Note[] = [];

    const logger = this.logger?.child({ useCase: 'PublishNotesUseCase' });
    logger?.info(`Starting publishing of ${input.notes.length} notes`);

    for (const note of input.notes) {
      const noteLogger = logger?.child({ noteId: note.id, slug: note.slug });
      try {
        noteLogger?.debug('Rendering markdown');
        const bodyHtml = await this.markdownRenderer.render(note.markdown);
        noteLogger?.debug('Building HTML page');
        const fullHtml = this.buildHtmlPage(note, bodyHtml);

        const pageRoute = this.buildPageRoute(note);
        noteLogger?.debug('Saving content to storage', { route: pageRoute });
        await this.contentStorage.save({
          route: pageRoute,
          content: fullHtml,
        });

        published++;
        succeeded.push(note);
        noteLogger?.info('Note published successfully', { route: pageRoute });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ noteId: note.id, message });
        noteLogger?.error('Failed to publish note', { error: message });
      }
    }

    if (succeeded.length > 0) {
      logger?.info(`Updating site manifest and indexes for ${succeeded.length} published notes`);
      const pages: ManifestPage[] = succeeded.map((n) => {
        const route = this.buildPageRoute(n);

        return {
          route,
          slug: n.slug,
          vaultPath: n.vaultPath,
          relativePath: n.relativePath,
          title: n.frontmatter?.title ?? this.extractTitle(n.vaultPath),
          tags: n.frontmatter?.tags ?? [],
          publishedAt: n.publishedAt,
          updatedAt: n.updatedAt,
        };
      });

      pages.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

      const manifest: Manifest = { pages };
      await this.siteIndex.saveManifest(manifest);
      await this.siteIndex.rebuildAllIndexes(manifest);
      logger?.info('Site manifest and indexes updated');
    }

    logger?.info(`Publishing complete: ${published} notes published, ${errors.length} errors`);
    if (errors.length > 0) {
      logger?.warn('Some notes failed to publish', { errors });
    }

    return { published, errors };
  }

  /**
   * Construit la route HTTP finale pour la page, en appliquant les règles :
   * /<route_sans_slash_initial>/[<relativePath>/]<slug>/
   *
   * Ex :
   *   route = "/codex"
   *   relativePath = "puissances/divinites"
   *   slug = "thormak"
   * -> "/codex/puissances/divinites/thormak/"
   */
  private buildPageRoute(note: Note): string {
    const rawRoute = (note.route ?? '').trim();
    const rawRelativePath = (note.relativePath ?? '').trim();

    // Nettoyage de la route : on garde le leading slash côté résultat, pas dans les segments
    const routeSegment = rawRoute
      .replace(/^\/+/, '') // vire les slashes en début
      .replace(/\/+$/, ''); // vire les slashes en fin

    // Nettoyage du relativePath : jamais de slash en début/fin
    const relativeSegment = rawRelativePath.replace(/^\/+/, '').replace(/\/+$/, '');

    const segments: string[] = [];

    if (routeSegment.length > 0) {
      segments.push(routeSegment);
    }

    if (relativeSegment.length > 0) {
      segments.push(...relativeSegment.split('/').filter((s) => s.length > 0));
    }

    segments.push(note.slug);

    // On garde un trailing slash, conforme à ton contrat
    return '/' + segments.join('/');
  }

  private buildHtmlPage(note: Note, bodyHtml: string): string {
    // Tu peux étoffer ici (header/footer) si besoin ; pour l’instant on reste sur un fragment
    return `
  <div class="markdown-body">
    ${bodyHtml}
  </div>`;
  }

  private extractTitle(vaultPath: string | undefined): string {
    if (!vaultPath) {
      return 'Untitled';
    }

    const parts = vaultPath.split('/');
    const filename = parts.at(-1) || 'Untitled';
    const title = filename.replace(/\.mdx?$/i, '');

    return title.charAt(0).toUpperCase() + title.slice(1);
  }
}
