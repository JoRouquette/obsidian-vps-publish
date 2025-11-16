import type { Note } from '../../domain/entities/Note';
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
    private readonly siteIndex: SiteIndexPort
  ) {}

  async execute(input: PublishNotesInput): Promise<PublishNotesOutput> {
    let published = 0;
    const errors: { noteId: string; message: string }[] = [];
    const succeeded: Note[] = [];

    for (const note of input.notes) {
      try {
        const bodyHtml = await this.markdownRenderer.render(note.markdown);
        const fullHtml = this.buildHtmlPage(note, bodyHtml);

        const pageRoute = this.buildPageRoute(note);

        await this.contentStorage.save({
          route: pageRoute,
          content: fullHtml,
        });

        published++;
        succeeded.push(note);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ noteId: note.id, message });
      }
    }

    if (succeeded.length > 0) {
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
    return '/' + segments.join('/') + '/';
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
