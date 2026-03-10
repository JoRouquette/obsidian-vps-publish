import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { fromEvent, throttleTime } from 'rxjs';

/**
 * Scroll-to-top floating action button.
 *
 * Best practices implemented:
 * - Shows only when content is at least 2x viewport height AND user has scrolled down
 * - Positioned bottom-right with adequate spacing
 * - Uses FAB (Floating Action Button) pattern from Material Design
 * - Smooth scroll animation
 * - Accessible: keyboard support, aria-label, reduced motion support
 * - SSR-safe: all DOM operations guarded with isPlatformBrowser
 * - Throttled scroll listener for performance
 * - Listens to .main scroll container (not window) for shell layout compatibility
 */
@Component({
  selector: 'app-scroll-to-top',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    @if (isVisible()) {
      <button
        mat-fab
        class="scroll-to-top-btn"
        (click)="scrollToTop()"
        aria-label="Remonter en haut de la page"
        matTooltip="Haut de page"
        matTooltipPosition="left"
      >
        <mat-icon>keyboard_arrow_up</mat-icon>
      </button>
    }
  `,
  styles: `
    :host {
      display: contents;
    }

    .scroll-to-top-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 1000;
      animation: fadeIn 0.2s ease-out;

      /* Respect user preference for reduced motion */
      @media (prefers-reduced-motion: reduce) {
        animation: none;
      }
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: scale(0.8);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    /* Mobile adjustments */
    @media (max-width: 768px) {
      .scroll-to-top-btn {
        bottom: 16px;
        right: 16px;
      }
    }

    /* Ensure button doesn't overlap with footer on very small screens */
    @media (max-height: 500px) {
      .scroll-to-top-btn {
        bottom: 8px;
        right: 8px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScrollToTopComponent implements AfterViewInit {
  /** Minimum scroll position to show the button */
  private readonly SCROLL_THRESHOLD = 300;

  /** Content must be at least this multiple of viewport height to show button */
  private readonly MIN_CONTENT_HEIGHT_RATIO = 2;

  /** CSS selector for the main scrollable container */
  private readonly MAIN_CONTAINER_SELECTOR = '.main';

  /** Whether the button is currently visible */
  readonly isVisible = signal(false);

  private readonly isBrowser: boolean;
  private mainContainer: HTMLElement | null = null;

  constructor(
    @Inject(PLATFORM_ID) platformId: object,
    private readonly destroyRef: DestroyRef
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    // Find the main scrollable container
    this.mainContainer = document.querySelector(this.MAIN_CONTAINER_SELECTOR);

    // Initial check
    this.checkScrollPosition();

    // Listen to scroll events on the main container (or fallback to window)
    const scrollTarget = this.mainContainer ?? globalThis;
    fromEvent(scrollTarget, 'scroll', { passive: true })
      .pipe(
        throttleTime(100, undefined, { leading: true, trailing: true }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.checkScrollPosition());
  }

  /**
   * Scroll smoothly to the top of the main container
   */
  scrollToTop(): void {
    if (!this.isBrowser) return;

    if (this.mainContainer) {
      this.mainContainer.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    } else {
      globalThis.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  }

  /**
   * Check current scroll position and content height to update visibility.
   * Button is visible only when:
   * 1. User has scrolled past the threshold (300px)
   * 2. Page content is at least 2x the viewport height
   */
  private checkScrollPosition(): void {
    if (!this.isBrowser) return;

    let scrollY: number;
    let viewportHeight: number;
    let contentHeight: number;

    if (this.mainContainer) {
      scrollY = this.mainContainer.scrollTop;
      viewportHeight = this.mainContainer.clientHeight;
      contentHeight = this.mainContainer.scrollHeight;
    } else {
      scrollY = globalThis.scrollY ?? globalThis.pageYOffset ?? 0;
      viewportHeight = globalThis.innerHeight ?? 0;
      contentHeight = document.documentElement.scrollHeight ?? 0;
    }

    const hasScrolledEnough = scrollY > this.SCROLL_THRESHOLD;
    const contentIsTallEnough = contentHeight >= viewportHeight * this.MIN_CONTENT_HEIGHT_RATIO;

    this.isVisible.set(hasScrolledEnough && contentIsTallEnough);
  }
}
