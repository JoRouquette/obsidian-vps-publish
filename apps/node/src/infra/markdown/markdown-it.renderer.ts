import MarkdownIt from 'markdown-it';
import type { LoggerPort, MarkdownRendererPort } from '@core-application';
import { AssetRef, PublishableNote, ResolvedWikilink } from '@core-domain';

export class MarkdownItRenderer implements MarkdownRendererPort {
  private readonly md: MarkdownIt;

  constructor(private readonly logger?: LoggerPort) {
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
    });
  }

  async render(note: PublishableNote): Promise<string> {
    const withAssets = this.injectAssets(note.content, note.assets ?? []);
    const withLinks = this.injectWikilinks(withAssets, note.resolvedWikilinks ?? []);
    const html = this.md.render(withLinks);

    this.logger?.info('Markdown rendered to HTML', {
      noteId: note.noteId,
      slug: note.routing.slug,
    });
    this.logger?.debug('Rendered HTML content', html);
    return html;
  }

  private injectAssets(content: string, assets: AssetRef[]): string {
    return assets.reduce(
      (acc, asset) => acc.split(asset.raw).join(this.renderAsset(asset)),
      content
    );
  }

  private injectWikilinks(content: string, links: ResolvedWikilink[]): string {
    return links.reduce(
      (acc, link) => acc.split(link.raw).join(this.renderWikilink(link)),
      content
    );
  }

  private renderAsset(asset: AssetRef): string {
    const src = this.buildAssetUrl(asset.target);
    const classes = ['md-asset', `md-asset-${asset.kind}`];

    if (asset.display.alignment) {
      classes.push(`align-${asset.display.alignment}`);
      if (asset.display.alignment === 'left' || asset.display.alignment === 'right') {
        classes.push('is-inline');
      }
    }
    if (asset.display.classes?.length) {
      classes.push(...asset.display.classes);
    }

    const wrapperStyles: string[] = [];
    const mediaStyles: string[] = [];

    if (asset.display.width) {
      wrapperStyles.push(`max-width:${asset.display.width}px`);
      mediaStyles.push(`max-width:${asset.display.width}px`);
    }
    if (asset.display.alignment === 'center') {
      wrapperStyles.push('margin-inline:auto; text-align:center');
    } else if (asset.display.alignment === 'right') {
      wrapperStyles.push('margin-inline-start:auto');
    } else if (asset.display.alignment === 'left') {
      wrapperStyles.push('margin-inline-end:auto');
    }

    const styleAttr = wrapperStyles.length ? ` style="${wrapperStyles.join(';')}"` : '';
    const mediaStyleAttr = mediaStyles.length ? ` style="${mediaStyles.join(';')}"` : '';

    let inner = '';
    switch (asset.kind) {
      case 'image':
        inner = `<img class="${classes.join(' ')}" src="${src}" alt="" loading="lazy"${mediaStyleAttr}${styleAttr}>`;
        return inner;
      case 'audio':
        inner = `<audio controls src="${src}"${mediaStyleAttr}></audio>`;
        break;
      case 'video':
        inner = `<video controls src="${src}"${mediaStyleAttr}></video>`;
        break;
      case 'pdf':
        inner = this.renderDownload(src, asset.target, 'pdf');
        break;
      default:
        inner = this.renderDownload(src, asset.target, 'other');
        break;
    }

    return `\n<figure class="${classes.join(' ')}"${styleAttr}>${inner}</figure>\n`;
  }

  private renderWikilink(link: ResolvedWikilink): string {
    const label = this.escapeHtml(
      link.alias ?? (link.subpath ? `${link.target}#${link.subpath}` : link.target)
    );

    if (link.isResolved) {
      const hrefTarget = link.href ?? link.path ?? link.target;
      const href = this.escapeAttribute(encodeURI(hrefTarget));
      return `<a class="wikilink" href="${href}">${label}</a>`;
    }

    return `<span class="wikilink wikilink-unresolved" style="color: var(--mat-sys-primary);">${label}</span>`;
  }

  private buildAssetUrl(target: string): string {
    const normalized = target.replace(/^\/+/, '').replace(/^assets\//, '');
    return `/assets/${encodeURI(normalized)}`;
  }

  private renderDownload(src: string, label: string, kind: string): string {
    const escapedLabel = this.escapeHtml(label);
    const title = `Download ${escapedLabel}`;
    return `<div class="md-asset-download md-asset-${kind}">
  <a class="md-asset-download-btn" href="${src}" download>
    <span class="md-asset-download-label">${escapedLabel}</span>
    <span class="md-asset-download-action" aria-label="${this.escapeAttribute(title)}">Download</span>
  </a>
</div>`;
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
}
