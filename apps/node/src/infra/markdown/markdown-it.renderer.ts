import type { MarkdownRendererPort } from '@core-application';
import type { LoggerPort } from '@core-domain';
import { type AssetRef, type PublishableNote, type ResolvedWikilink } from '@core-domain';
import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import footnote from 'markdown-it-footnote';

import { CalloutRendererService } from './callout-renderer.service';
import { HeadingSlugger } from './heading-slugger';
import { TagFilterService } from './tag-filter.service';

export class MarkdownItRenderer implements MarkdownRendererPort {
  private readonly md: MarkdownIt;
  private readonly calloutRenderer: CalloutRendererService;
  private readonly tagFilter: TagFilterService;
  private readonly headingSlugger: HeadingSlugger;

  constructor(
    calloutRenderer?: CalloutRendererService,
    private readonly logger?: LoggerPort
  ) {
    this.calloutRenderer = calloutRenderer ?? new CalloutRendererService();
    this.tagFilter = new TagFilterService();
    this.headingSlugger = new HeadingSlugger();
    this.md = new MarkdownIt({
      html: true,
      linkify: false, // Wikilinks already converted before render (no auto-linking needed)
      typographer: true,
    });

    // Register plugins
    this.md.use(footnote);
    this.md.use(anchor, {
      slugify: (s: string) => this.headingSlugger.slugify(s),
      permalink: false, // Don't add permalink links
      level: [1, 2, 3, 4, 5, 6], // Add IDs to all heading levels
    });

    this.calloutRenderer.register(this.md);
    this.customizeTableRenderer();
    this.customizeListRenderer();
    this.customizeFootnoteRenderer();
  }

  /**
   * Customize footnote rendering to normalize IDs (remove colons)
   * Fixes issue where IDs like "fn:1" break HTML/CSS selectors
   */
  private customizeFootnoteRenderer(): void {
    // Override footnote anchor rendering (the superscript link)
    this.md.renderer.rules.footnote_ref = (tokens, idx, _options, _env, _slf) => {
      const id = Number(tokens[idx].meta.id + 1);
      const refId = `fnref-${id}`;
      const label = tokens[idx].meta.label ?? id;

      return `<sup class="footnote-ref"><a href="#fn-${id}" id="${refId}">${label}</a></sup>`;
    };

    // Override footnote block opening
    this.md.renderer.rules.footnote_block_open = () => {
      return '<section class="footnotes" role="doc-endnotes">\n<hr>\n<ol class="footnotes-list">\n';
    };

    // Override footnote block closing
    this.md.renderer.rules.footnote_block_close = () => {
      return '</ol>\n</section>\n';
    };

    // Override footnote item opening
    this.md.renderer.rules.footnote_open = (tokens, idx) => {
      const id = Number(tokens[idx].meta.id + 1);
      return `<li id="fn-${id}" class="footnote-item">`;
    };

    // Override footnote anchor (back to reference link)
    this.md.renderer.rules.footnote_anchor = (tokens, idx) => {
      const id = Number(tokens[idx].meta.id + 1);
      const refId = `fnref-${id}`;
      return ` <a href="#${refId}" class="footnote-backref" aria-label="Back to reference ${id}">↩</a>`;
    };
  }

  /**
   * Customise le rendu des listes pour supprimer les <p> superflus dans les <li>
   * Les <p> ajoutent du padding/margin inutile
   */
  private customizeListRenderer(): void {
    const defaultParagraphOpen =
      this.md.renderer.rules.paragraph_open ||
      function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
      };

    const defaultParagraphClose =
      this.md.renderer.rules.paragraph_close ||
      function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
      };

    this.md.renderer.rules.paragraph_open = (tokens, idx, options, env, self) => {
      // Simple check: count open/close list_item tokens before this paragraph
      let listItemDepth = 0;
      for (let i = 0; i < idx; i++) {
        if (tokens[i].type === 'list_item_open') listItemDepth++;
        if (tokens[i].type === 'list_item_close') listItemDepth--;
      }

      // If we're inside a list item (depth > 0), skip <p> tag
      if (listItemDepth > 0) {
        return '';
      }
      return defaultParagraphOpen(tokens, idx, options, env, self);
    };

    this.md.renderer.rules.paragraph_close = (tokens, idx, options, env, self) => {
      // Same logic for closing tag
      let listItemDepth = 0;
      for (let i = 0; i < idx; i++) {
        if (tokens[i].type === 'list_item_open') listItemDepth++;
        if (tokens[i].type === 'list_item_close') listItemDepth--;
      }

      if (listItemDepth > 0) {
        return '';
      }
      return defaultParagraphClose(tokens, idx, options, env, self);
    };
  }

  /**
   * Customise le rendu des tables pour ajouter un wrapper .table-wrapper
   * permettant le scroll horizontal et le sticky header
   */
  private customizeTableRenderer(): void {
    // Sauvegarder les renderers par défaut
    const defaultTableOpen =
      this.md.renderer.rules.table_open ||
      function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
      };
    const defaultTableClose =
      this.md.renderer.rules.table_close ||
      function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
      };

    // Override table_open pour ajouter le wrapper
    this.md.renderer.rules.table_open = (tokens, idx, options, env, self) => {
      const tableTag = defaultTableOpen(tokens, idx, options, env, self);
      return '<div class="table-wrapper">\n' + tableTag;
    };

    // Override table_close pour fermer le wrapper
    this.md.renderer.rules.table_close = (tokens, idx, options, env, self) => {
      const tableTag = defaultTableClose(tokens, idx, options, env, self);
      return tableTag + '\n</div>\n';
    };
  }

  async render(note: PublishableNote): Promise<string> {
    const contentAssets = (note.assets ?? []).filter((a) => a.origin !== 'frontmatter');
    const contentLinks = (note.resolvedWikilinks ?? []).filter((l) => l.origin !== 'frontmatter');

    const withAssets = this.injectAssets(note.content, contentAssets);
    const withLinks = this.injectWikilinks(withAssets, contentLinks);
    const html = this.md.render(withLinks);

    const iconFontLink = [
      '<link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons" />',
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />',
    ].join('\n');
    const userCss = this.calloutRenderer.getUserCss();
    const inlineCalloutCss =
      `.material-symbols-outlined,.material-icons{font-family:'Material Symbols Outlined','Material Icons';font-weight:400;font-style:normal;font-size:1.1em;line-height:1;font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-flex;vertical-align:text-bottom;}` +
      `.callout-icon{font-family:'Material Symbols Outlined','Material Icons';}`;
    const withStyles = `${iconFontLink}\n<style data-callout-styles>${inlineCalloutCss}${
      userCss ? '\n' + userCss : ''
    }</style>\n${html}`;

    // Filter ignored tags from rendered HTML
    // TODO: Get ignored tags from FolderConfig or VPSConfig when implemented
    const ignoredTags: string[] = [];
    const filtered = this.tagFilter.filterTags(withStyles, ignoredTags);

    this.logger?.debug('Markdown rendered to HTML', {
      noteId: note.noteId,
      slug: note.routing.slug,
    });
    this.logger?.debug('Rendered HTML content', { htmlLength: filtered.length });
    return filtered;
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
      let hrefTarget = link.href ?? link.path ?? link.target;

      // Handle heading anchors: [[#Heading]] or [[Page#Heading]]
      // Transform heading text to slug matching markdown-it's behavior
      if (hrefTarget.includes('#')) {
        const [path, heading] = hrefTarget.split('#');
        if (heading) {
          const slug = this.headingSlugger.slugify(heading);
          hrefTarget = path ? `${path}#${slug}` : `#${slug}`;
        }
      }

      const href = this.escapeAttribute(encodeURI(hrefTarget));
      return `<a class="wikilink" data-wikilink="${this.escapeAttribute(link.target)}" href="${href}">${label}</a>`;
    }

    const tooltip = 'Cette page arrive prochainement';
    return `<span class="wikilink wikilink-unresolved" role="link" aria-disabled="true" title="${this.escapeAttribute(
      tooltip
    )}" data-tooltip="${this.escapeAttribute(tooltip)}" data-wikilink="${this.escapeAttribute(
      link.target
    )}">${label}</span>`;
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
