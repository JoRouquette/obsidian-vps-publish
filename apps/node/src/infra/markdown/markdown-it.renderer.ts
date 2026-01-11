import type { MarkdownRendererPort, RenderContext } from '@core-application';
import type { LoggerPort, Manifest, ManifestPage } from '@core-domain';
import { type AssetRef, type PublishableNote, type ResolvedWikilink } from '@core-domain';
import { load } from 'cheerio';
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
   * Supports multiple references to the same footnote with unique IDs
   */
  private customizeFootnoteRenderer(): void {
    // Override footnote anchor rendering (the superscript link)
    this.md.renderer.rules.footnote_ref = (tokens, idx, _options, _env, _slf) => {
      const id = Number(tokens[idx].meta.id + 1);
      const subId = tokens[idx].meta.subId;
      const refId = subId > 0 ? `fnref-${id}-${subId}` : `fnref-${id}`;
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
      const subId = tokens[idx].meta.subId;
      const refId = subId > 0 ? `fnref-${id}-${subId}` : `fnref-${id}`;
      const label = subId > 0 ? `Back to reference ${id}-${subId}` : `Back to reference ${id}`;
      return ` <a href="#${refId}" class="footnote-backref" aria-label="${label}">↩</a>`;
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

  async render(note: PublishableNote, context?: RenderContext): Promise<string> {
    const contentAssets = (note.assets ?? []).filter((a) => a.origin !== 'frontmatter');
    const contentLinks = (note.resolvedWikilinks ?? []).filter((l) => l.origin !== 'frontmatter');

    // Convert markdown links to .md files to unresolved spans
    // (since they're not in resolvedWikilinks, they're not published)
    const contentWithHandledMdLinks = this.handleMarkdownLinks(note.content);

    const withAssets = this.injectAssets(contentWithHandledMdLinks, contentAssets);
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

    // Clean and normalize all links (remove .md extensions, add proper classes, translate paths)
    // Pass manifest from context for vault-to-route path translation
    const cleaned = this.cleanAndNormalizeLinks(withStyles, context?.manifest);

    // Filter ignored tags from rendered HTML
    // Get from context if available, otherwise use empty array (no default filtering)
    const ignoredTags = context?.ignoredTags ?? [];
    const filtered = this.tagFilter.filterTags(cleaned, ignoredTags);

    this.logger?.debug('Markdown rendered to HTML', {
      noteId: note.noteId,
      slug: note.routing.slug,
      ignoredTagsCount: ignoredTags.length,
    });
    this.logger?.debug('Rendered HTML content', { htmlLength: filtered.length });
    return filtered;
  }

  /**
   * Handle markdown links to .md files by rendering them as unresolved wikilink spans.
   * This is necessary when markdown links weren't converted upstream or when resolvedWikilinks is empty.
   */
  private handleMarkdownLinks(content: string): string {
    const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)]+\.md(?:#[^)]*)?)\)/gi;
    return content.replace(MARKDOWN_LINK_REGEX, (match, text, href) => {
      // Skip external URLs
      if (/^https?:\/\//i.test(href)) {
        return match;
      }

      // Remove .md extension
      const target = href.replace(/\.md$/i, '');

      // Render as unresolved wikilink span
      return this.renderUnresolvedWikilink(target, text);
    });
  }

  private renderUnresolvedWikilink(target: string, label: string): string {
    const escapedLabel = this.escapeHtml(label);
    const escapedTarget = this.escapeHtml(target);
    return `<span class="wikilink wikilink-unresolved" role="link" aria-disabled="true" title="Cette page arrive prochainement" data-tooltip="Cette page arrive prochainement" data-wikilink="${escapedTarget}">${escapedLabel}</span>`;
  }

  /**
   * Clean and normalize all links in rendered HTML to match wikilink template.
   *
   * Ensures ALL internal links follow the wikilink structure:
   * - Valid link (page exists): <a class="wikilink" data-wikilink="target" href="/path">Label</a>
   * - Invalid link (page missing): <span class="wikilink wikilink-unresolved" ...>Label</span>
   *
   * This method:
   * - Removes .md extensions from href and data-wikilink
   * - Adds data-wikilink attribute if missing (using href as source)
   * - Translates vault paths to routed paths using manifest (if available)
   * - Validates links against manifest and converts invalid ones to unresolved spans
   * - Ensures class="wikilink" for all internal links
   * - Preserves external URLs unchanged
   *
   * Handles links from:
   * - Dataview blocks (TABLE, LIST)
   * - DataviewJS custom views (dv.view())
   * - Any plugin-generated content
   *
   * @param html - Rendered HTML content
   * @param manifest - Optional manifest for vault-to-route path translation and validation
   * @returns HTML with all links normalized to wikilink template
   */
  private cleanAndNormalizeLinks(html: string, manifest?: Manifest): string {
    const $ = load(html);

    // Process all <a> tags to normalize to wikilink template
    $('a').each((_, element) => {
      const $link = $(element);
      let href = $link.attr('href');
      let dataWikilink = $link.attr('data-wikilink');
      let dataHref = $link.attr('data-href'); // Dataview attribute

      // Skip links without href or data-wikilink
      if (!href && !dataWikilink) {
        return;
      }

      // Skip external URLs (http://, https://, mailto:, etc.)
      if (href && this.isExternalUrl(href)) {
        return;
      }

      // Skip fragment-only links (internal anchors like #section)
      if (href && href.startsWith('#')) {
        return;
      }

      // This is an internal link - normalize to wikilink template
      let cleanedHref = '';
      let cleanedWikilink = '';
      let matchedPage: ManifestPage | undefined;

      // Clean and process href
      if (href) {
        cleanedHref = this.cleanLinkPath(href);

        // Translate vault path to routed path if manifest available
        if (manifest) {
          const result = this.translateToRoutedPathWithValidation(cleanedHref, manifest);
          cleanedHref = result.path;
          matchedPage = result.matchedPage;
        }

        // If no data-wikilink, derive it from href (remove leading /)
        if (!dataWikilink) {
          cleanedWikilink = cleanedHref.replace(/^\//, '');
          // Remove anchor for data-wikilink if present
          const anchorIndex = cleanedWikilink.indexOf('#');
          if (anchorIndex > 0) {
            cleanedWikilink = cleanedWikilink.substring(0, anchorIndex);
          }
        }
      }

      // Clean data-wikilink attribute
      if (dataWikilink) {
        cleanedWikilink = this.cleanLinkPath(dataWikilink);
      }

      // Clean data-href attribute (Dataview)
      if (dataHref) {
        let cleanedDataHref = this.cleanLinkPath(dataHref);
        if (manifest) {
          const result = this.translateToRoutedPathWithValidation(cleanedDataHref, manifest);
          cleanedDataHref = result.path;
          // Use matchedPage from data-href if href didn't have one
          if (!matchedPage) {
            matchedPage = result.matchedPage;
          }
        }
      }

      // Check if link is valid (page exists in manifest)
      const isValidLink = manifest ? matchedPage !== undefined : true; // Assume valid if no manifest

      if (!isValidLink) {
        // Transform invalid link to unresolved span (like wikilinks)
        const label = $link.text();
        const unresolvedSpan = this.renderUnresolvedWikilink(cleanedWikilink || cleanedHref, label);
        $link.replaceWith(unresolvedSpan);
        return; // Skip further processing for this element
      }

      // Valid link - update attributes
      $link.attr('href', cleanedHref);

      // Set data-wikilink attribute (required for wikilink template)
      if (cleanedWikilink) {
        $link.attr('data-wikilink', cleanedWikilink);
      }

      // Update data-href if it exists
      if (dataHref) {
        let cleanedDataHref = this.cleanLinkPath(dataHref);
        if (manifest) {
          const result = this.translateToRoutedPathWithValidation(cleanedDataHref, manifest);
          cleanedDataHref = result.path;
        }
        $link.attr('data-href', cleanedDataHref);
      }

      // Ensure class="wikilink" (required for wikilink template)
      const classes = $link.attr('class') || '';
      const classList = classes.split(/\s+/).filter((c) => c.length > 0);
      if (!classList.includes('wikilink')) {
        classList.push('wikilink'); // Add to existing classes, preserving order
      }
      $link.attr('class', classList.join(' '));
    });

    return $.html();
  }

  /**
   * Clean a link path by removing .md extension while preserving anchors.
   *
   * @param path - Link path (e.g., "note.md#section" or "note.md")
   * @returns Cleaned path (e.g., "note#section" or "note")
   */
  private cleanLinkPath(path: string): string {
    // Match .md extension followed by optional anchor (#...)
    // Case-insensitive to handle .MD, .Md, etc.
    return path.replace(/\.md(#.*)?$/i, '$1');
  }

  /**
   * Check if a URL is external (http://, https://, mailto:, etc.)
   *
   * @param url - URL to check
   * @returns True if external, false otherwise
   */
  private isExternalUrl(url: string): boolean {
    return /^[a-z]+:\/\//i.test(url) || url.startsWith('mailto:');
  }

  /**
   * Check if a link is an internal link (relative path, starts with /)
   *
   * @param path - Link path
   * @returns True if internal, false otherwise
   */
  private isInternalLink(path: string): boolean {
    // Internal links are relative paths or start with /
    // External links start with http://, https://, etc.
    return !this.isExternalUrl(path) && (path.startsWith('/') || !path.includes('://'));
  }

  /**
   * Translate a vault path to a routed path using the manifest.
   *
   * For links generated by Dataview/plugins that use vault paths (e.g., "Aran'talas/Aran'talas"),
   * this finds the corresponding page in the manifest and returns its full routed path
   * (e.g., "/aran-talas/Aran'talas/Aran'talas").
   *
   * @param path - Vault path (may be relative or absolute, with or without leading /)
   * @param manifest - Manifest containing all published pages with their routes
   * @returns Routed path if found in manifest, otherwise returns original path
   */
  private translateToRoutedPath(path: string, manifest: Manifest): string {
    // Extract base path and anchor
    const anchorIndex = path.indexOf('#');
    const basePath = anchorIndex >= 0 ? path.substring(0, anchorIndex) : path;
    const anchor = anchorIndex >= 0 ? path.substring(anchorIndex) : '';

    // Normalize base path (remove leading slash for comparison)
    const normalizedPath = basePath.replace(/^\//, '');

    // Find matching page in manifest by comparing normalized paths
    const matchingPage = manifest.pages.find((page) => {
      if (!page.vaultPath) return false;

      // Compare vault paths (normalize both for consistent matching)
      const pageVaultPath = page.vaultPath.replace(/\.md$/i, '').replace(/^\//, '');
      const pageRelativePath = page.relativePath?.replace(/\.md$/i, '').replace(/^\//, '');

      return (
        pageVaultPath === normalizedPath ||
        pageRelativePath === normalizedPath ||
        pageVaultPath.toLowerCase() === normalizedPath.toLowerCase() ||
        pageRelativePath?.toLowerCase() === normalizedPath.toLowerCase()
      );
    });

    if (matchingPage) {
      // Return the full routed path from manifest + anchor
      return matchingPage.route + anchor;
    }

    // If no match found, return original path (may need leading / for absolute paths)
    return path.startsWith('/') ? path : '/' + path;
  }

  /**
   * Translate a vault path to a routed path using the manifest, with validation.
   *
   * Similar to translateToRoutedPath but also returns whether the page was found,
   * allowing caller to distinguish valid links from invalid ones.
   *
   * @param path - Vault path (may be relative or absolute, with or without leading /)
   * @param manifest - Manifest containing all published pages with their routes
   * @returns Object with translated path and matched page (undefined if not found)
   */
  private translateToRoutedPathWithValidation(
    path: string,
    manifest: Manifest
  ): { path: string; matchedPage?: ManifestPage } {
    // Extract base path and anchor
    const anchorIndex = path.indexOf('#');
    const basePath = anchorIndex >= 0 ? path.substring(0, anchorIndex) : path;
    const anchor = anchorIndex >= 0 ? path.substring(anchorIndex) : '';

    // Normalize base path (remove leading slash for comparison)
    const normalizedPath = basePath.replace(/^\//, '');

    // Find matching page in manifest by comparing normalized paths
    const matchingPage = manifest.pages.find((page) => {
      if (!page.vaultPath) return false;

      // Compare vault paths (normalize both for consistent matching)
      const pageVaultPath = page.vaultPath.replace(/\.md$/i, '').replace(/^\//, '');
      const pageRelativePath = page.relativePath?.replace(/\.md$/i, '').replace(/^\//, '');

      return (
        pageVaultPath === normalizedPath ||
        pageRelativePath === normalizedPath ||
        pageVaultPath.toLowerCase() === normalizedPath.toLowerCase() ||
        pageRelativePath?.toLowerCase() === normalizedPath.toLowerCase()
      );
    });

    if (matchingPage) {
      // Return the full routed path from manifest + anchor
      return {
        path: matchingPage.route + anchor,
        matchedPage: matchingPage,
      };
    }

    // If no match found, return original path with leading slash but no matched page
    return {
      path: path.startsWith('/') ? path : '/' + path,
      matchedPage: undefined,
    };
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

      // Remove .md extension if present (fallback safety for malformed paths)
      hrefTarget = hrefTarget.replace(/\.md$/i, '');

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
