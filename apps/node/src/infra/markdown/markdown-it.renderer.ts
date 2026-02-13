import type { MarkdownRendererPort, RenderContext } from '@core-application';
import type {
  AssetRef,
  LoggerPort,
  Manifest,
  ManifestPage,
  PublishableNote,
  ResolvedWikilink,
} from '@core-domain';
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

    // Wrap text following floated figures in <p> tags for proper text wrapping
    const fixedFloats = this.wrapTextAfterFloatedFigures(cleaned);

    // Filter ignored tags from rendered HTML
    // Get from context if available, otherwise use empty array (no default filtering)
    const ignoredTags = context?.ignoredTags ?? [];
    const filtered = this.tagFilter.filterTags(fixedFloats, ignoredTags);

    this.logger?.debug('Markdown rendered to HTML', {
      noteId: note.noteId,
      slug: note.routing.slug,
      ignoredTagsCount: ignoredTags.length,
    });
    this.logger?.debug('Rendered HTML content', { htmlLength: filtered.length });
    return filtered;
  }

  /**
   * Wrap text immediately following floated figures in <p> tags for proper float behavior.
   *
   * Markdown-it cannot handle inline HTML block elements (like <figure>) properly.
   * When we inject <figure class="align-left|right"> before parsing, markdown-it creates
   * invalid HTML: <p><figure>...</figure>text</p>. Browsers auto-correct this by closing
   * the <p> before <figure>, leaving text unwrapped.
   *
   * Without <p> wrappers, text cannot flow around floats. This method detects such cases
   * and wraps naked text following floated figures into proper <p> elements.
   *
   * Pattern: </figure>TEXT until next block element → </figure><p>TEXT</p>
   */
  private wrapTextAfterFloatedFigures(html: string): string {
    // Match floated figure followed by unwrapped text/inline elements
    // Captures text/inline tags until hitting a block-level tag
    const blockTags =
      'h[1-6]|p|div|ul|ol|li|blockquote|pre|table|figure|hr|section|article|details|header|footer|nav|aside';
    const pattern = new RegExp(
      String.raw`(<figure\s+[^>]*class="[^"]*align-(?:left|right)[^"]*"[^>]*>.*?</figure>)\s*([^<][\s\S]*?)(?=<(?:${blockTags})|$)`,
      'gi'
    );

    return html.replaceAll(pattern, (match, figureTag, textContent) => {
      // Only wrap if there's actual text content (not just whitespace)
      const trimmed = textContent.trim();
      if (trimmed.length === 0) {
        return figureTag;
      }

      // Check if text is already wrapped in inline tags but not in a block tag
      // If it starts with an inline tag, include it in the <p>
      return `${figureTag}<p>${textContent.trimStart()}</p>`;
    });
  }

  /**
   * Handle markdown links to .md files by rendering them as unresolved wikilink spans.
   * This is necessary when markdown links weren't converted upstream or when resolvedWikilinks is empty.
   */
  private handleMarkdownLinks(content: string): string {
    const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)]+\.md(?:#[^)]*)?)\)/gi;
    return content.replaceAll(MARKDOWN_LINK_REGEX, (match: string, text: string, href: string) => {
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
    // Load HTML - Cheerio wraps content in html/body tags, we'll extract body content at the end
    const $ = load(html);

    // Process all <a> tags to normalize to wikilink template
    $('a').each((_, element) => {
      this.processLinkElement($(element), manifest);
    });

    // Return body content only to avoid html/head/body wrapper tags
    return $('body').html() ?? $.html();
  }

  /**
   * Process a single link element for normalization.
   */
  private processLinkElement(
    $link: ReturnType<ReturnType<typeof load>>,
    manifest?: Manifest
  ): void {
    const href = $link.attr('href');
    const dataWikilink = $link.attr('data-wikilink');
    const dataHref = $link.attr('data-href');

    // Skip links without href or data-wikilink
    if (!href && !dataWikilink) return;

    // Skip external URLs and fragment-only links
    if (href && this.isExternalUrl(href)) return;
    if (href?.startsWith('#')) return;

    // Process internal link
    const processed = this.processInternalLink(href, dataWikilink, dataHref, manifest);

    // Check if link is valid
    // - If link has data-wikilink attribute, it was created by injectWikilinks and resolved by backend → trust it
    // - Otherwise, validate against manifest (if available)
    const isBackendResolvedWikilink = !!dataWikilink && !!href && !href.startsWith('#');
    const isValidLink =
      isBackendResolvedWikilink || !manifest || processed.matchedPage !== undefined;

    // Debug logging for specific link
    if (
      href?.toLowerCase().includes('sens-et-capacites') ||
      dataWikilink?.toLowerCase().includes('sens et capacités')
    ) {
      this.logger?.debug('Processing link for Sens et capacités', {
        href,
        dataWikilink,
        processedHref: processed.cleanedHref,
        processedWikilink: processed.cleanedWikilink,
        hasMatchedPage: processed.matchedPage !== undefined,
        matchedPageRoute: processed.matchedPage?.route,
        isBackendResolvedWikilink,
        isValidLink,
        manifestPresent: !!manifest,
      });
    }

    if (!isValidLink) {
      const label = $link.text();
      const unresolvedSpan = this.renderUnresolvedWikilink(
        processed.cleanedWikilink || processed.cleanedHref,
        label
      );
      $link.replaceWith(unresolvedSpan);
      return;
    }

    // Valid link - update attributes
    this.updateLinkAttributes($link, processed, dataHref, manifest);
  }

  /**
   * Process an internal link and return cleaned values.
   */
  private processInternalLink(
    href: string | undefined,
    dataWikilink: string | undefined,
    dataHref: string | undefined,
    manifest?: Manifest
  ): { cleanedHref: string; cleanedWikilink: string; matchedPage?: ManifestPage } {
    let cleanedHref = '';
    let cleanedWikilink = '';
    let matchedPage: ManifestPage | undefined;

    if (href) {
      cleanedHref = this.cleanLinkPath(href);
      if (manifest) {
        const result = this.translateToRoutedPathWithValidation(cleanedHref, manifest);
        cleanedHref = result.path;
        matchedPage = result.matchedPage;
      }
      if (!dataWikilink) {
        cleanedWikilink = this.deriveWikilinkFromHref(cleanedHref);
      }
    }

    if (dataWikilink) {
      cleanedWikilink = this.cleanLinkPath(dataWikilink);
    }

    if (dataHref && manifest) {
      const cleanedDataHref = this.cleanLinkPath(dataHref);
      const result = this.translateToRoutedPathWithValidation(cleanedDataHref, manifest);
      matchedPage ??= result.matchedPage;
    }

    return { cleanedHref, cleanedWikilink, matchedPage };
  }

  /**
   * Update attributes on a valid link element.
   */
  private updateLinkAttributes(
    $link: ReturnType<ReturnType<typeof load>>,
    processed: { cleanedHref: string; cleanedWikilink: string },
    dataHref: string | undefined,
    manifest?: Manifest
  ): void {
    $link.attr('href', processed.cleanedHref);

    if (processed.cleanedWikilink) {
      $link.attr('data-wikilink', processed.cleanedWikilink);
    }

    if (dataHref) {
      let cleanedDataHref = this.cleanLinkPath(dataHref);
      if (manifest) {
        const result = this.translateToRoutedPathWithValidation(cleanedDataHref, manifest);
        cleanedDataHref = result.path;
      }
      $link.attr('data-href', cleanedDataHref);
    }

    this.ensureWikilinkClass($link);
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
   * Derive a wikilink target from a cleaned href by removing leading slash and anchor.
   *
   * @param cleanedHref - Cleaned href path
   * @returns Wikilink target string
   */
  private deriveWikilinkFromHref(cleanedHref: string): string {
    let wikilink = cleanedHref.replace(/^\//, '');
    const anchorIndex = wikilink.indexOf('#');
    if (anchorIndex > 0) {
      wikilink = wikilink.substring(0, anchorIndex);
    }
    return wikilink;
  }

  /**
   * Ensure a link element has the 'wikilink' class.
   *
   * @param $link - Cheerio link element
   */
  private ensureWikilinkClass($link: ReturnType<ReturnType<typeof load>>): void {
    const classes = $link.attr('class') || '';
    const classList = classes.split(/\s+/).filter((c: string) => c.length > 0);
    if (!classList.includes('wikilink')) {
      classList.push('wikilink');
    }
    $link.attr('class', classList.join(' '));
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
   * Translate a vault path to a routed path using the manifest, with validation.
   *
   * For links generated by Dataview/plugins that use vault paths (e.g., "Aran'talas/Aran'talas"),
   * this finds the corresponding page in the manifest and returns its full routed path
   * (e.g., "/aran-talas/Aran'talas/Aran'talas").
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

    // Debug logging for specific path
    const isTargetPath = normalizedPath.toLowerCase().includes('sens-et-capacites');
    if (isTargetPath) {
      this.logger?.debug('translateToRoutedPathWithValidation called', {
        originalPath: path,
        basePath,
        anchor,
        normalizedPath,
        manifestPagesCount: manifest.pages.length,
      });
    }

    // Find matching page in manifest by comparing normalized paths
    const matchingPage = manifest.pages.find((page) => {
      if (!page.vaultPath) return false;

      // Compare both vault paths AND routed paths
      const pageVaultPath = page.vaultPath.replace(/\.md$/i, '').replace(/^\//, '');
      const pageRelativePath = page.relativePath?.replace(/\.md$/i, '').replace(/^\//, '');
      const pageRoute = page.route.replace(/^\//, '');

      const matches =
        pageVaultPath === normalizedPath ||
        pageRelativePath === normalizedPath ||
        pageRoute === normalizedPath ||
        pageVaultPath.toLowerCase() === normalizedPath.toLowerCase() ||
        pageRelativePath?.toLowerCase() === normalizedPath.toLowerCase() ||
        pageRoute.toLowerCase() === normalizedPath.toLowerCase();

      if (isTargetPath && page.title?.toLowerCase().includes('sens')) {
        this.logger?.debug('Comparing with page', {
          pageTitle: page.title,
          pageRoute,
          pageVaultPath,
          pageRelativePath,
          normalizedPath,
          matches,
        });
      }

      return matches;
    });

    if (isTargetPath) {
      this.logger?.debug('translateToRoutedPathWithValidation result', {
        found: matchingPage !== undefined,
        matchedPageTitle: matchingPage?.title,
        matchedPageRoute: matchingPage?.route,
      });
    }

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
    // Debug logging for specific wikilink
    const sensLink = links.find((l) => l.path?.toLowerCase().includes('sens et capacités'));
    if (sensLink) {
      const rawIndex = content.indexOf(sensLink.raw);
      const contextStart = Math.max(0, rawIndex - 50);
      const contextEnd = Math.min(content.length, rawIndex + sensLink.raw.length + 50);

      this.logger?.debug('Injecting wikilink for Sens et capacités', {
        raw: sensLink.raw,
        rawLength: sensLink.raw.length,
        path: sensLink.path,
        subpath: sensLink.subpath,
        alias: sensLink.alias,
        isResolved: sensLink.isResolved,
        href: sensLink.href,
        contentIncludes: content.includes(sensLink.raw),
        rawIndex,
        contextBefore: content.substring(contextStart, rawIndex),
        contextAfter: content.substring(rawIndex + sensLink.raw.length, contextEnd),
      });

      // Test the replacement
      const testSplit = content.split(sensLink.raw);
      this.logger?.debug('Wikilink replacement test', {
        splitParts: testSplit.length,
        firstPartEnd: testSplit[0]?.substring(testSplit[0].length - 30),
        secondPartStart: testSplit[1]?.substring(0, 30),
      });
    }

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

    // For floated images (left/right), let CSS handle max-width responsively with min(320px, 45%)
    // Only add inline max-width for centered or non-aligned images
    const isFloated = asset.display.alignment === 'left' || asset.display.alignment === 'right';

    if (asset.display.width && !isFloated) {
      // Centered/block images: use inline width as specified
      wrapperStyles.push(`max-width:${asset.display.width}px`);
      mediaStyles.push(`max-width:${asset.display.width}px`);
    } else if (asset.display.width && isFloated) {
      // Floated images: only limit the <img> natural size, figure width is CSS-controlled
      mediaStyles.push(`max-width:${asset.display.width}px`);
    }

    // Only add margin styles for centered images (block layout)
    // Floated images (left/right) don't need margin auto - CSS handles positioning
    if (asset.display.alignment === 'center') {
      wrapperStyles.push('margin-inline:auto; text-align:center');
    }

    const styleAttr = wrapperStyles.length ? ` style="${wrapperStyles.join(';')}"` : '';
    const mediaStyleAttr = mediaStyles.length ? ` style="${mediaStyles.join(';')}"` : '';

    // Inline images (left/right aligned) should NOT have newlines to preserve text flow
    // Block images (center or no alignment) should have newlines for proper block separation
    const isInline = asset.display.alignment === 'left' || asset.display.alignment === 'right';
    const prefix = isInline ? '' : '\n';
    const suffix = isInline ? '' : '\n';

    let inner = '';
    switch (asset.kind) {
      case 'image':
        inner = `<img src="${src}" alt="" loading="lazy"${mediaStyleAttr}>`;
        return `${prefix}<figure class="${classes.join(' ')}"${styleAttr}>${inner}</figure>${suffix}`;
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

    return `${prefix}<figure class="${classes.join(' ')}"${styleAttr}>${inner}</figure>${suffix}`;
  }

  private renderWikilink(link: ResolvedWikilink): string {
    const label = this.escapeHtml(
      link.alias ?? (link.subpath ? `${link.target}#${link.subpath}` : link.target)
    );

    if (link.isResolved) {
      let hrefTarget = link.href ?? link.path ?? link.target;

      // Remove .md extension if present (fallback safety for malformed paths)
      hrefTarget = hrefTarget.replace(/\.md$/i, '');

      // If link has a subpath but href doesn't include it yet, append it
      // This handles cases where backend provides href without fragment
      if (link.subpath && !hrefTarget.includes('#')) {
        const slugifiedSubpath = this.headingSlugger.slugify(link.subpath);
        hrefTarget = `${hrefTarget}#${slugifiedSubpath}`;
      }

      // Handle heading anchors: [[#Heading]] or [[Page#Heading]]
      // Transform heading text to slug matching markdown-it's behavior
      if (hrefTarget.includes('#')) {
        const [path, heading] = hrefTarget.split('#');
        if (heading) {
          const slug = this.headingSlugger.slugify(heading);
          hrefTarget = path ? `${path}#${slug}` : `#${slug}`;

          // Debug log for specific case
          if (heading.toLowerCase().includes('vision thermique')) {
            this.logger?.debug('Slugifying heading in renderWikilink', {
              originalHref: link.href,
              originalHeading: heading,
              slugifiedHeading: slug,
              finalHrefTarget: hrefTarget,
            });
          }
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
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  private escapeAttribute(input: string): string {
    return this.escapeHtml(input).replaceAll('`', '&#96;');
  }
}
