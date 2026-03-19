/**
 * Validate Links Service
 *
 * Post-processes all HTML files in content storage to validate and normalize links.
 * This ensures ALL links (from markdown-it, dataview, templates, etc.) are validated
 * against the manifest and corrected to use proper routing.
 *
 * Invalid links (pages not in manifest) are transformed to unresolved wikilink spans.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { type LoggerPort, type ManifestPage } from '@core-domain';
import * as cheerio from 'cheerio';

export class ValidateLinksService {
  constructor(private readonly logger?: LoggerPort) {}

  /**
   * Validate and normalize all links in HTML files within contentRoot
   * @param contentRoot - Root directory containing HTML files
   * @param manifest - Manifest containing all published pages
   * @returns Number of files processed and number of links fixed
   */
  async validateAllLinks(
    contentRoot: string,
    manifest: { pages: ManifestPage[] }
  ): Promise<{ filesProcessed: number; linksFixed: number; filesModified: number }> {
    const log = this.logger?.child({ operation: 'validateAllLinks' });
    const startTime = performance.now();

    let filesProcessed = 0;
    let linksFixed = 0;
    let filesModified = 0;

    // Build a fast lookup map: vaultPath -> routed path
    const pathMap = new Map<string, ManifestPage>();
    for (const page of manifest.pages) {
      if (page.vaultPath) {
        pathMap.set(page.vaultPath.toLowerCase(), page);
      }
    }

    log?.debug('Built path lookup map', {
      contentRoot,
      manifestPages: manifest.pages.length,
      pathMapSize: pathMap.size,
    });

    // Recursively process all HTML files
    const htmlFiles = await this.findHtmlFiles(contentRoot);
    log?.debug('Found HTML files', { count: htmlFiles.length });

    for (const htmlPath of htmlFiles) {
      filesProcessed++;

      try {
        const originalHtml = await fs.readFile(htmlPath, 'utf-8');
        const fixedHtml = this.validateLinksInHtml(originalHtml, pathMap, log);

        // Only write if content changed
        if (fixedHtml !== originalHtml) {
          await fs.writeFile(htmlPath, fixedHtml, 'utf-8');
          filesModified++;

          // Count transformed elements (unresolved spans) in fixed HTML
          const unresolvedCount = (fixedHtml.match(/class="[^"]*wikilink-unresolved[^"]*"/g) || [])
            .length;
          const originalUnresolvedCount = (
            originalHtml.match(/class="[^"]*wikilink-unresolved[^"]*"/g) || []
          ).length;
          const linksTransformedInThisFile = unresolvedCount - originalUnresolvedCount;

          if (linksTransformedInThisFile > 0) {
            linksFixed += linksTransformedInThisFile;
          }

          // Also count links that were updated to use proper routes
          const fixedLinksCount = (fixedHtml.match(/<a [^>]*href="/g) || []).length;
          const originalLinksCount = (originalHtml.match(/<a [^>]*href="/g) || []).length;
          if (fixedLinksCount !== originalLinksCount || linksTransformedInThisFile > 0) {
            // If link counts differ or we transformed some, count it
            linksFixed += Math.max(linksTransformedInThisFile, 1);
          }

          log?.debug('Fixed links in HTML file', {
            file: path.relative(contentRoot, htmlPath),
            linksFixed: linksTransformedInThisFile,
          });
        }
      } catch (error) {
        log?.error('Failed to process HTML file', {
          file: path.relative(contentRoot, htmlPath),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const duration = performance.now() - startTime;
    log?.info('Link validation completed', {
      filesProcessed,
      filesModified,
      linksFixed,
      durationMs: duration.toFixed(2),
    });

    return { filesProcessed, linksFixed, filesModified };
  }

  /**
   * Validate links within a single HTML document.
   *
   * This pass is intentionally more permissive than the renderer:
   * it can recover valid links from unresolved spans or Dataview-generated
   * `data-wikilink` placeholders once the final manifest is complete.
   */
  private validateLinksInHtml(
    html: string,
    pathMap: Map<string, ManifestPage>,
    log?: LoggerPort
  ): string {
    const $ = cheerio.load(html);
    let linksProcessed = 0;
    let linksTransformed = 0;

    $('a').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      const dataWikilink = $el.attr('data-wikilink');

      if (!href && !dataWikilink) {
        return;
      }

      linksProcessed++;

      if (
        href &&
        (href.startsWith('#') || href.startsWith('http://') || href.startsWith('https://'))
      ) {
        return;
      }

      if (href && (href.endsWith('/index') || href === '/index')) {
        return;
      }

      const hrefResolution = href ? this.resolveLinkCandidate(href, pathMap) : undefined;
      const wikilinkResolution = dataWikilink
        ? this.resolveLinkCandidate(this.normalizeWikilinkTarget(dataWikilink), pathMap)
        : undefined;
      const resolved = hrefResolution?.page ? hrefResolution : wikilinkResolution;

      if (resolved?.page) {
        const correctHref = resolved.fragment
          ? `${resolved.page.route}#${resolved.fragment}`
          : resolved.page.route;

        if ($el.attr('href') !== correctHref) {
          $el.attr('href', correctHref);
          linksTransformed++;
        }

        if (dataWikilink) {
          $el.attr('data-wikilink', this.normalizeWikilinkTarget(dataWikilink));
        }

        return;
      }

      const linkText = $el.text() || href || dataWikilink || '';
      const title = `Page inconnue : ${linkText}`;
      const wikilinkTarget = this.normalizeWikilinkTarget(dataWikilink || href || linkText);

      $el.replaceWith(
        `<span class="wikilink wikilink-unresolved" title="${this.escapeHtml(title)}" data-wikilink="${this.escapeHtml(wikilinkTarget)}">${this.escapeHtml(linkText)}</span>`
      );
      linksTransformed++;
    });

    $('[data-wikilink]').each((_, el) => {
      const $el = $(el);
      if ($el.is('a')) {
        return;
      }

      const rawTarget = $el.attr('data-wikilink');
      if (!rawTarget) {
        return;
      }

      linksProcessed++;

      const normalizedTarget = this.normalizeWikilinkTarget(rawTarget);
      if (!normalizedTarget) {
        return;
      }

      const resolved = this.resolveLinkCandidate(normalizedTarget, pathMap);
      if (!resolved.page) {
        return;
      }

      const href = resolved.fragment
        ? `${resolved.page.route}#${resolved.fragment}`
        : resolved.page.route;
      const classNames = ($el.attr('class') || '')
        .split(/\s+/)
        .filter(Boolean)
        .filter((cls) => cls !== 'wikilink-unresolved');

      if (!classNames.includes('wikilink')) {
        classNames.push('wikilink');
      }

      const $anchor = $('<a></a>');
      $anchor.attr('href', href);
      $anchor.attr('data-wikilink', normalizedTarget);
      $anchor.attr('class', classNames.join(' '));
      $anchor.html($el.html() || this.escapeHtml($el.text()));

      $el.replaceWith($anchor);
      linksTransformed++;
    });

    if (linksTransformed > 0) {
      log?.debug('Transformed links in HTML', {
        linksProcessed,
        linksTransformed,
      });
    }

    return linksTransformed > 0 ? $.html() : html;
  }

  /**
   * Resolve a link href against the manifest
   * Returns the matched page if found, undefined otherwise
   */
  private resolveLinkPath(
    href: string,
    pathMap: Map<string, ManifestPage>
  ): ManifestPage | undefined {
    // If href starts with '/', it's a routed path - check if it matches a page route
    if (href.startsWith('/')) {
      const normalizedRoute = href.toLowerCase();
      for (const page of pathMap.values()) {
        if (page.route.toLowerCase() === normalizedRoute) {
          return page;
        }
      }
      return undefined;
    }

    // Otherwise, treat as vault path or partial vault path
    const normalized = decodeURIComponent(href).toLowerCase();

    // Try exact match first
    let matched = pathMap.get(normalized);
    if (matched) {
      return matched;
    }

    // Try adding common extensions
    matched = pathMap.get(normalized + '.md');
    if (matched) {
      return matched;
    }

    // Try path-based matching (search for pages with matching vault paths)
    for (const [vaultPath, page] of pathMap.entries()) {
      // Check if the vaultPath ends with the normalized href (case-insensitive)
      if (vaultPath.endsWith(normalized) || vaultPath.endsWith(normalized + '.md')) {
        return page;
      }

      // Also check if href matches the page slug
      if (page.slug.value.toLowerCase() === normalized) {
        return page;
      }

      // Check if href is a partial match
      const pathSegments = vaultPath.split('/').map((s) => s.toLowerCase());
      const hrefSegments = normalized.split('/');

      if (hrefSegments.length > 0 && pathSegments.length >= hrefSegments.length) {
        const pathTail = pathSegments.slice(-hrefSegments.length);
        const match = hrefSegments.every((seg, i) => {
          const pathSeg = pathTail[i];
          return pathSeg === seg || pathSeg === seg + '.md';
        });

        if (match) {
          return page;
        }
      }
    }

    return undefined;
  }

  private resolveLinkCandidate(
    rawValue: string,
    pathMap: Map<string, ManifestPage>
  ): { page?: ManifestPage; fragment?: string } {
    const hashIndex = rawValue.indexOf('#');
    const basePath = hashIndex >= 0 ? rawValue.slice(0, hashIndex) : rawValue;
    const fragment = hashIndex >= 0 ? rawValue.slice(hashIndex + 1) : undefined;
    return {
      page: this.resolveLinkPath(basePath || rawValue, pathMap),
      fragment,
    };
  }

  private normalizeWikilinkTarget(target: string): string {
    return decodeURIComponent(target)
      .replace(/\.md(?=#|$)/i, '')
      .replace(/^\/+/, '');
  }

  /**
   * Recursively find all HTML files in a directory
   */
  private async findHtmlFiles(dir: string): Promise<string[]> {
    const results: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.findHtmlFiles(fullPath);
          results.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
          results.push(fullPath);
        }
      }
    } catch (error) {
      this.logger?.warn('Failed to read directory', {
        dir,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return results;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
