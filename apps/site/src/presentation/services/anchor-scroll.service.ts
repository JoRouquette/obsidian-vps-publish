import { isPlatformBrowser, ViewportScroller } from '@angular/common';
import { DestroyRef, Inject, Injectable, NgZone, PLATFORM_ID } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { parseInternalHref } from '@core-domain';
import { filter } from 'rxjs';

/**
 * Options for scroll behavior
 */
interface ScrollOptions {
  /** Maximum time in ms to wait for the target element (default: 2000) */
  timeout?: number;
  /** Scroll behavior: 'smooth' or 'auto' (default: 'smooth') */
  behavior?: ScrollBehavior;
  /** Block position: where to align the element (default: 'start') */
  block?: ScrollLogicalPosition;
}

const DEFAULT_OPTIONS: Required<ScrollOptions> = {
  timeout: 2000,
  behavior: 'smooth',
  block: 'start',
};

/**
 * Service to handle anchor (fragment) scrolling in Angular applications.
 *
 * Solves the problem where Angular Router's built-in `anchorScrolling` doesn't work
 * when clicking links to fragments on the **current page** (same route, different fragment).
 *
 * Features:
 * - SSR-safe: all DOM operations are guarded with `isPlatformBrowser`
 * - Handles router NavigationEnd events with fragments
 * - Handles same-page fragment clicks (where router doesn't navigate)
 * - Uses MutationObserver to wait for dynamically rendered elements
 * - Falls back to ViewportScroller.scrollToAnchor with document.getElementById fallback
 *
 * Usage in components:
 * 1. Inject the service
 * 2. For same-page fragments: call scrollToAnchor(fragmentId)
 * 3. Service automatically handles router-based navigation via init()
 */
@Injectable({ providedIn: 'root' })
export class AnchorScrollService {
  private readonly isBrowser: boolean;
  private observer: MutationObserver | null = null;

  constructor(
    @Inject(PLATFORM_ID) private readonly platformId: object,
    private readonly router: Router,
    private readonly viewportScroller: ViewportScroller,
    private readonly ngZone: NgZone,
    private readonly destroyRef: DestroyRef
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.initRouterSubscription();
  }

  /**
   * Initialize router subscription to handle fragment navigation.
   * Listens to NavigationEnd events and scrolls to fragment if present.
   */
  private initRouterSubscription(): void {
    if (!this.isBrowser) return;

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => {
        const fragment = this.extractFragment(event.urlAfterRedirects);
        if (fragment) {
          // Defer to allow content to render
          void this.scrollToAnchor(fragment);
        }
      });
  }

  /**
   * Scroll to an anchor element by its ID.
   *
   * This method:
   * 1. Immediately attempts to scroll if element exists
   * 2. If element doesn't exist, uses MutationObserver to wait for it
   * 3. Times out after configurable duration (default 2000ms)
   *
   * @param fragmentId The ID of the element to scroll to (without #)
   * @param options Optional scroll behavior configuration
   * @returns Promise that resolves when scroll completes or times out
   */
  async scrollToAnchor(fragmentId: string, options?: ScrollOptions): Promise<boolean> {
    if (!this.isBrowser || !fragmentId) {
      return false;
    }

    const opts: Required<ScrollOptions> = { ...DEFAULT_OPTIONS, ...options };

    // Try immediate scroll
    if (this.tryScroll(fragmentId, opts)) {
      return true;
    }

    // Element not found, wait for it using MutationObserver
    return this.waitForElementAndScroll(fragmentId, opts);
  }

  /**
   * Navigate to a same-page anchor and scroll to it.
   * Updates the URL hash without triggering a full navigation.
   *
   * Use this for handling clicks on fragment-only links (e.g., href="#section")
   * or links to the current page with a different fragment.
   *
   * @param fragmentId The fragment ID to navigate to
   * @param options Optional scroll behavior configuration
   */
  async navigateToAnchor(fragmentId: string, options?: ScrollOptions): Promise<boolean> {
    if (!this.isBrowser || !fragmentId) {
      return false;
    }

    // Update URL with fragment (without triggering Angular router)
    const currentPath = globalThis.location.pathname + globalThis.location.search;
    globalThis.history.pushState(null, '', `${currentPath}#${fragmentId}`);

    // Scroll to the element
    return this.scrollToAnchor(fragmentId, options);
  }

  /**
   * Check if a link targets the current page (same path, different or same fragment).
   *
   * @param href The href attribute of the link
   * @returns true if the link targets the current page
   */
  isCurrentPageLink(href: string): boolean {
    if (!this.isBrowser || !href) {
      return false;
    }

    const parsed = parseInternalHref(
      href,
      globalThis.location.pathname,
      globalThis.location.search
    );
    if (!parsed) {
      return false;
    }

    const currentPath = globalThis.location.pathname.replace(/\/+$/, '') || '/';
    return parsed.path === currentPath && parsed.search === (globalThis.location.search || '');
  }

  /**
   * Extract fragment from URL
   */
  private extractFragment(url: string): string | null {
    return (
      parseInternalHref(url, globalThis.location.pathname, globalThis.location.search)?.fragment ??
      null
    );
  }

  /**
   * Attempt to scroll to an element.
   * Handles special cases like scroll containers and URL-encoded IDs.
   */
  private tryScroll(fragmentId: string, options: Required<ScrollOptions>): boolean {
    if (!this.isBrowser) return false;

    // Decode URL-encoded fragment (e.g., %20 -> space)
    const decodedId = decodeURIComponent(fragmentId);

    // Try to find element by ID (getElementById handles most cases)
    let element = document.getElementById(decodedId);

    // Fallback: try with original (non-decoded) ID
    if (!element && decodedId !== fragmentId) {
      element = document.getElementById(fragmentId);
    }

    // Fallback: try querySelector with escaped ID for special characters
    if (!element) {
      try {
        element = document.querySelector(`[id="${CSS.escape(decodedId)}"]`);
      } catch {
        // CSS.escape might not be available in all environments
      }
    }

    // Fallback: try slugified version of the fragment
    // Handles cases where fragment is raw heading text (e.g., "Ténébra")
    // but heading ID is slugified (e.g., "tenebra")
    if (!element) {
      const slugified = this.slugifyFragment(decodedId);
      if (slugified !== decodedId) {
        element = document.getElementById(slugified);
      }
    }

    if (!element) {
      return false;
    }

    // Run outside Angular zone to avoid change detection during scroll
    this.ngZone.runOutsideAngular(() => {
      // Find the scroll container (.main element) for proper scroll calculation
      const scrollContainer = document.querySelector('.main');

      if (scrollContainer) {
        // Calculate target position relative to scroll container
        const containerRect = scrollContainer.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const currentScrollTop = scrollContainer.scrollTop;

        // Calculate the scroll position to bring element to top (with offset for padding)
        const scrollOffset = 20; // Small offset from top
        const targetScrollTop =
          currentScrollTop + (elementRect.top - containerRect.top) - scrollOffset;

        scrollContainer.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: options.behavior,
        });
      } else {
        // Fallback to scrollIntoView if container not found
        element.scrollIntoView({
          behavior: options.behavior,
          block: options.block,
        });
      }
    });

    return true;
  }

  /**
   * Wait for an element to appear in the DOM, then scroll to it.
   * Uses MutationObserver for efficient waiting.
   */
  private waitForElementAndScroll(
    fragmentId: string,
    options: Required<ScrollOptions>
  ): Promise<boolean> {
    if (!this.isBrowser) {
      return Promise.resolve(false);
    }

    return new Promise<boolean>((resolve) => {
      const startTime = Date.now();

      // Cleanup previous observer if any
      this.cleanupObserver();

      // Create mutation observer
      this.observer = new MutationObserver(() => {
        // Check if element now exists
        if (this.tryScroll(fragmentId, options)) {
          this.cleanupObserver();
          resolve(true);
          return;
        }

        // Check timeout
        if (Date.now() - startTime >= options.timeout) {
          this.cleanupObserver();
          resolve(false);
        }
      });

      // Observe the entire document for additions
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // Also use requestAnimationFrame as backup (for elements added synchronously)
      const checkWithRaf = () => {
        if (this.tryScroll(fragmentId, options)) {
          this.cleanupObserver();
          resolve(true);
          return;
        }

        if (Date.now() - startTime < options.timeout && this.observer) {
          requestAnimationFrame(checkWithRaf);
        }
      };

      requestAnimationFrame(checkWithRaf);

      // Timeout fallback
      setTimeout(() => {
        if (this.observer) {
          this.cleanupObserver();
          resolve(false);
        }
      }, options.timeout);
    });
  }

  /**
   * Cleanup MutationObserver
   */
  private cleanupObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  /**
   * Slugify a fragment string to match heading IDs generated by markdown-it-anchor.
   * Mirrors the HeadingSlugger logic used on the backend.
   */
  private slugifyFragment(text: string): string {
    return text
      .normalize('NFKD')
      .replaceAll(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replaceAll(/[^\w\s-]/g, '')
      .replaceAll(/\s+/g, '-')
      .replaceAll(/-+/g, '-')
      .replaceAll(/^-+|-+$/g, '');
  }
}
