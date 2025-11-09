import type { Note } from '../../domain/entities/Note';
import type { MarkdownRendererPort } from '../ports/MarkdownRendererPort';
import type { ContentStoragePort } from '../ports/ContentStoragePort';
import type { SiteIndexPort, Manifest, ManifestPage } from '../ports/SiteIndexPort';

export interface PublishNotesInput {
  notes: Note[];
}

export interface PublishNotesOutput {
  published: number;
  errors: { noteId: string; message: string }[];
}

const PAGE_STYLE = `
:root { color-scheme: dark; --bg:#050608; --bg-elevated:#11131a; --border:#232635; --text:#f7f7fb; --muted:#a0a3b8; --accent:#e0b05a; --accent-soft:rgba(224,176,90,.08); }
*,*::before,*::after { box-sizing: border-box; }
body { margin:0; min-height:100vh; background: radial-gradient(circle at top, #151827 0, #050608 55%); color:var(--text); font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.container { max-width:820px; margin:0 auto; padding:3rem 1.5rem 4rem; }
.site-header { margin-bottom:2.5rem; }
.home-link { font-size:1.5rem; font-weight:600; letter-spacing:.04em; text-transform:uppercase; text-decoration:none; color:var(--accent); }
.site-tagline { margin:.5rem 0 0; color:var(--muted); font-size:.95rem; }
.site-meta { margin:.25rem 0 0; color:var(--muted); font-size:.8rem; }
.page-content { background: linear-gradient(135deg, rgba(12,16,32,.95), rgba(10,10,18,.95)); border-radius:1.25rem; border:1px solid var(--border); padding:2rem 1.75rem; box-shadow:0 18px 40px rgba(0,0,0,.55); line-height:1.6; }
.page-content h1,.page-content h2,.page-content h3,.page-content h4 { margin-top:1.4rem; margin-bottom:.6rem; }
.page-content h1 { font-size:1.8rem; }
.page-content h2 { font-size:1.4rem; }
.page-content p { margin:.4rem 0; }
.page-content ul,.page-content ol { padding-left:1.3rem; }
a { color:var(--accent); text-decoration:none; }
a:hover { text-decoration:underline; }
code { font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace; font-size:.9em; }
pre code { display:block; padding:.75rem .9rem; background:#0b0d16; border-radius:.6rem; border:1px solid #202234; overflow-x:auto; }
`;

export class PublishNotesUseCase {
  constructor(
    private readonly markdownRenderer: MarkdownRendererPort,
    private readonly contentStorage: ContentStoragePort,
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

        await this.contentStorage.savePage({
          route: `${note.route}/${note.relativePath}`,
          html: fullHtml,
        });

        published++;
        succeeded.push(note);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ noteId: note.id, message });
      }
    }

    if (succeeded.length > 0) {
      const pages: ManifestPage[] = succeeded.map((n) => ({
        route: n.route,
        slug: n.slug,
        vaultPath: n.vaultPath,
        relativePath: n.relativePath,
        title: n.frontmatter.title,
        description: n.frontmatter.description,
        tags: n.frontmatter.tags,
        publishedAt: n.publishedAt,
        updatedAt: n.updatedAt,
      }));
      pages.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

      const manifest: Manifest = { pages };
      await this.siteIndex.saveManifest(manifest);
      await this.siteIndex.rebuildAllIndexes(manifest);
    }

    return { published, errors };
  }

  private buildHtmlPage(note: Note, bodyHtml: string): string {
    const title = this.escapeHtml(note.frontmatter.title);
    const description = note.frontmatter.description
      ? this.escapeHtml(note.frontmatter.description)
      : '';
    const publishedAt = note.publishedAt.toISOString();
    const updatedAt = note.updatedAt.toISOString();
    const dateMeta = note.frontmatter.date ?? publishedAt;

    const metaDescriptionTag = description
      ? `<meta name="description" content="${description}">`
      : '';
    const tagsMeta = note.frontmatter.tags?.length
      ? `<meta name="keywords" content="${note.frontmatter.tags.map((t) => this.escapeHtml(t)).join(', ')}">`
      : '';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${title} – Scribe Ektaron</title>
  ${metaDescriptionTag}
  ${tagsMeta}
  <meta name="publishedAt" content="${this.escapeHtml(publishedAt)}">
  <meta name="updatedAt" content="${this.escapeHtml(updatedAt)}">
  <meta name="originalDate" content="${this.escapeHtml(dateMeta)}">
  <style>${PAGE_STYLE}</style>
</head>
<body>
  <main class="container">
    <header class="site-header">
      <a href="/" class="home-link">Scribe Ektaron</a>
      ${description ? `<p class="site-tagline">${description}</p>` : '<p class="site-tagline">Publication personnelle</p>'}
      <p class="site-meta">Publié le ${this.escapeHtml(publishedAt.substring(0, 10))}</p>
    </header>
    <article class="page-content">
${bodyHtml}
    </article>
  </main>
</body>
</html>`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
