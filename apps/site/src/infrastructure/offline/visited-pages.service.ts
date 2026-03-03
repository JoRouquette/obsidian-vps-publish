import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';

/**
 * Metadata for a visited page (lightweight, stored in localStorage).
 */
export interface VisitedPageMeta {
  /** Page slug/route (e.g., "getting-started" or "guides/installation") */
  slug: string;

  /** Page title */
  title: string;

  /** Last visit timestamp (ISO string) */
  lastVisited: string;

  /** Full URL path for navigation */
  url: string;
}

/**
 * Browser-only service that tracks visited pages for offline access.
 *
 * Features:
 * - Stores lightweight metadata (slug, title, timestamp, URL)
 * - Does NOT store page content (ngsw handles caching)
 * - Limited to MAX_PAGES to prevent storage bloat
 * - LRU eviction (least recently visited removed first)
 *
 * @example
 * ```typescript
 * // Mark page as visited
 * visitedPages.recordVisit('getting-started', 'Getting Started', '/getting-started');
 *
 * // Get recently visited pages
 * const pages = visitedPages.getRecentlyVisited(10);
 * ```
 */
@Injectable({ providedIn: 'root' })
export class VisitedPagesService {
  private readonly platformId = inject(PLATFORM_ID);

  private readonly STORAGE_KEY = 'vps-visited-pages';
  private readonly MAX_PAGES = 50;

  /**
   * Record a page visit (updates timestamp if already visited).
   */
  recordVisit(slug: string, title: string, url: string): void {
    if (!this.isBrowser) {
      return;
    }

    const pages = this.loadPages();
    const now = new Date().toISOString();

    // Remove existing entry for this slug (will be re-added at end)
    const filtered = pages.filter((p) => p.slug !== slug);

    // Add/update entry
    filtered.push({
      slug,
      title,
      lastVisited: now,
      url,
    });

    // Sort by lastVisited (most recent first) and trim to MAX_PAGES
    filtered.sort((a, b) => new Date(b.lastVisited).getTime() - new Date(a.lastVisited).getTime());
    const trimmed = filtered.slice(0, this.MAX_PAGES);

    this.savePages(trimmed);
  }

  /**
   * Get recently visited pages (most recent first).
   */
  getRecentlyVisited(limit?: number): VisitedPageMeta[] {
    if (!this.isBrowser) {
      return [];
    }

    const pages = this.loadPages();
    return limit ? pages.slice(0, limit) : pages;
  }

  /**
   * Check if a specific page has been visited.
   */
  hasVisited(slug: string): boolean {
    if (!this.isBrowser) {
      return false;
    }

    const pages = this.loadPages();
    return pages.some((p) => p.slug === slug);
  }

  /**
   * Get metadata for a specific visited page.
   */
  getVisitedPage(slug: string): VisitedPageMeta | null {
    if (!this.isBrowser) {
      return null;
    }

    const pages = this.loadPages();
    return pages.find((p) => p.slug === slug) ?? null;
  }

  /**
   * Clear all visited pages history.
   */
  clearHistory(): void {
    if (!this.isBrowser) {
      return;
    }

    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Get total count of visited pages.
   */
  get visitedCount(): number {
    if (!this.isBrowser) {
      return 0;
    }

    return this.loadPages().length;
  }

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private loadPages(): VisitedPageMeta[] {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      // Validate entries
      return parsed.filter(
        (p): p is VisitedPageMeta =>
          p &&
          typeof p.slug === 'string' &&
          typeof p.title === 'string' &&
          typeof p.lastVisited === 'string' &&
          typeof p.url === 'string'
      );
    } catch {
      return [];
    }
  }

  private savePages(pages: VisitedPageMeta[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(pages));
    } catch {
      // Ignore storage errors (quota exceeded, private mode, etc.)
    }
  }
}
