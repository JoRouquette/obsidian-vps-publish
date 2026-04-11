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

import {
  type LoggerPort,
  type ManifestPage,
  UNAVAILABLE_INTERNAL_PAGE_MESSAGE,
} from '@core-domain';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';

import {
  normalizeManifestWikilinkTarget,
  resolveManifestLinkCandidate,
} from '../links/manifest-link-resolver.util';
import { HeadingSlugger } from '../markdown/heading-slugger';

export class ValidateLinksService {
  private readonly headingSlugger = new HeadingSlugger();

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

    log?.debug('Prepared manifest pages for link validation', {
      contentRoot,
      manifestPages: manifest.pages.length,
    });

    // Recursively process all HTML files
    const htmlFiles = await this.findHtmlFiles(contentRoot);
    log?.debug('Found HTML files', { count: htmlFiles.length });

    for (const htmlPath of htmlFiles) {
      filesProcessed++;

      try {
        const originalHtml = await fs.readFile(htmlPath, 'utf-8');
        const currentRoutePath = this.deriveCurrentRoutePath(contentRoot, htmlPath);
        const fixedHtml = this.validateLinksInHtml(
          originalHtml,
          manifest.pages,
          currentRoutePath,
          log,
          (manifest as { folderDisplayNames?: Record<string, string> }).folderDisplayNames
        );

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
    pages: ManifestPage[],
    currentRoutePath: string,
    log?: LoggerPort,
    folderDisplayNames?: Record<string, string>
  ): string {
    const $ = cheerio.load(html);
    let linksProcessed = 0;
    let linksTransformed = 0;

    $('a').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      const dataHref = $el.attr('data-href');
      const dataWikilink = $el.attr('data-wikilink');

      if (!href && !dataHref && !dataWikilink) {
        return;
      }

      linksProcessed++;

      if (
        href &&
        (href.startsWith('#') || href.startsWith('http://') || href.startsWith('https://'))
      ) {
        return;
      }

      // Public asset links are already canonical output URLs, not internal page links.
      if (href && this.isPublicAssetUrl(href)) {
        return;
      }

      if (href && (href.endsWith('/index') || href === '/index')) {
        return;
      }

      const hrefResolution = href
        ? this.resolveLinkCandidate(href, pages, currentRoutePath, log, folderDisplayNames)
        : undefined;
      const dataHrefResolution = dataHref
        ? this.resolveLinkCandidate(dataHref, pages, currentRoutePath, log, folderDisplayNames)
        : undefined;
      const wikilinkResolution = dataWikilink
        ? this.resolveLinkCandidate(
            this.normalizeWikilinkTarget(dataWikilink),
            pages,
            currentRoutePath,
            log,
            folderDisplayNames
          )
        : undefined;
      const resolved = hrefResolution?.page
        ? hrefResolution
        : dataHrefResolution?.page
          ? dataHrefResolution
          : wikilinkResolution;

      if (resolved?.page) {
        const correctHref = this.buildResolvedHref(
          resolved.page.route,
          resolved.query,
          resolved.fragmentCanonical ??
            (resolved.fragment ? this.normalizeFragment(resolved.fragment) : undefined)
        );

        if ($el.attr('href') !== correctHref) {
          $el.attr('href', correctHref);
          linksTransformed++;
        }

        if (dataHref && $el.attr('data-href') !== correctHref) {
          $el.attr('data-href', correctHref);
          linksTransformed++;
        }

        if (dataWikilink) {
          $el.attr('data-wikilink', this.normalizeWikilinkTarget(dataWikilink));
        }

        return;
      }

      const linkText = $el.text() || href || dataWikilink || '';
      const wikilinkTarget = this.normalizeWikilinkTarget(dataWikilink || href || linkText);

      $el.replaceWith(this.renderUnavailableWikilink(linkText, wikilinkTarget));
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

      const resolved = this.resolveLinkCandidate(normalizedTarget, pages, currentRoutePath, log);
      if (!resolved.page) {
        this.normalizeUnavailableWikilinkElement($el, normalizedTarget);
        return;
      }

      const href =
        resolved.fragment || resolved.query
          ? this.buildResolvedHref(
              resolved.page.route,
              resolved.query,
              resolved.fragmentCanonical ??
                (resolved.fragment ? this.normalizeFragment(resolved.fragment) : undefined)
            )
          : this.encodeInternalHref(resolved.page.route);
      const classNames = ($el.attr('class') || '')
        .split(/\s+/)
        .filter(Boolean)
        .filter((cls) => cls !== 'wikilink-unresolved' && cls !== 'fm-wikilink-unresolved');

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

    $('.wikilink-unresolved, .fm-wikilink-unresolved').each((_, el) => {
      const $el = $(el);
      if ($el.is('a') || $el.attr('data-wikilink')) {
        return;
      }

      const rawTarget = ($el.text() || '').trim();
      if (!rawTarget) {
        return;
      }

      linksProcessed++;

      const normalizedTarget = this.normalizeWikilinkTarget(rawTarget);
      const resolved = this.resolveLinkCandidate(
        normalizedTarget,
        pages,
        currentRoutePath,
        log,
        folderDisplayNames
      );
      if (!resolved.page) {
        this.normalizeUnavailableWikilinkElement($el, normalizedTarget);
        return;
      }

      const href =
        resolved.fragment || resolved.query
          ? this.buildResolvedHref(
              resolved.page.route,
              resolved.query,
              resolved.fragmentCanonical ??
                (resolved.fragment ? this.normalizeFragment(resolved.fragment) : undefined)
            )
          : this.encodeInternalHref(resolved.page.route);
      const classNames = ($el.attr('class') || '')
        .split(/\s+/)
        .filter(Boolean)
        .filter((cls) => cls !== 'wikilink-unresolved' && cls !== 'fm-wikilink-unresolved');

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
  private resolveLinkCandidate(
    rawValue: string,
    pages: ManifestPage[],
    currentRoutePath: string,
    log?: LoggerPort,
    folderDisplayNames?: Record<string, string>
  ): { page?: ManifestPage; query?: string; fragment?: string; fragmentCanonical?: string } {
    const resolved = resolveManifestLinkCandidate(
      rawValue,
      pages,
      currentRoutePath,
      folderDisplayNames
    );

    if (resolved.ambiguousCandidates?.length) {
      log?.warn('Ambiguous internal link left unresolved during post-build validation', {
        rawValue,
        candidates: resolved.ambiguousCandidates.map((page) => page.route),
      });
    }

    return {
      page: resolved.page,
      query: resolved.query,
      fragment: resolved.fragment,
      fragmentCanonical: resolved.fragmentCanonical,
    };
  }

  private normalizeWikilinkTarget(target: string): string {
    return normalizeManifestWikilinkTarget(target);
  }

  private isPublicAssetUrl(url: string): boolean {
    return /^\/assets\//i.test(url);
  }

  private deriveCurrentRoutePath(contentRoot: string, htmlPath: string): string {
    const relativeHtmlPath = path.relative(contentRoot, htmlPath).split(path.sep).join('/');
    const withoutExtension = relativeHtmlPath.replace(/\.html$/i, '');
    return withoutExtension ? `/${withoutExtension}` : '/';
  }

  private buildResolvedHref(route: string, query?: string, fragment?: string): string {
    const normalizedFragment = fragment ? `#${fragment}` : '';
    return this.encodeInternalHref(`${route}${query ?? ''}${normalizedFragment}`);
  }

  private normalizeFragment(fragment: string): string {
    const decodedFragment = this.safeDecodeURIComponent(fragment);
    return decodedFragment.startsWith('^')
      ? decodedFragment
      : this.headingSlugger.slugify(decodedFragment);
  }

  private encodeInternalHref(href: string): string {
    return encodeURI(this.safeDecodeURI(href));
  }

  private safeDecodeURIComponent(value: string): string {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  private safeDecodeURI(value: string): string {
    try {
      return decodeURI(value);
    } catch {
      return value;
    }
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

  private renderUnavailableWikilink(linkText: string, wikilinkTarget: string): string {
    return `<span class="wikilink wikilink-unresolved" role="link" aria-disabled="true" tabindex="0" title="${this.escapeHtml(
      UNAVAILABLE_INTERNAL_PAGE_MESSAGE
    )}" data-tooltip="${this.escapeHtml(
      UNAVAILABLE_INTERNAL_PAGE_MESSAGE
    )}" data-wikilink="${this.escapeHtml(wikilinkTarget)}">${this.escapeHtml(linkText)}</span>`;
  }

  private normalizeUnavailableWikilinkElement(
    $element: cheerio.Cheerio<AnyNode>,
    normalizedTarget: string
  ): void {
    const classNames = ($element.attr('class') || '').split(/\s+/).filter(Boolean);

    if (!classNames.includes('wikilink')) {
      classNames.push('wikilink');
    }
    if (!classNames.includes('wikilink-unresolved')) {
      classNames.push('wikilink-unresolved');
    }

    $element.attr('class', classNames.join(' '));
    $element.attr('role', 'link');
    $element.attr('aria-disabled', 'true');
    $element.attr('tabindex', '0');
    $element.attr('title', UNAVAILABLE_INTERNAL_PAGE_MESSAGE);
    $element.attr('data-tooltip', UNAVAILABLE_INTERNAL_PAGE_MESSAGE);
    $element.attr('data-wikilink', normalizedTarget);
  }
}
