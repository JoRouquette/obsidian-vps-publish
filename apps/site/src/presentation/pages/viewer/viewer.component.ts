import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  computed,
  effect,
  ElementRef,
  EnvironmentInjector,
  Inject,
  Injector,
  inject,
  OnDestroy,
  PLATFORM_ID,
  signal,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltip, MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import type { LeafletBlock } from '@core-domain/entities/leaflet-block';
import { UNAVAILABLE_INTERNAL_PAGE_MESSAGE } from '@core-domain';
import {
  catchError,
  distinctUntilChanged,
  filter,
  from,
  map,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';

import { CatalogFacade } from '../../../application/facades/catalog-facade';
import { CONTENT_REPOSITORY } from '../../../domain/ports/tokens';
import { HttpContentRepository } from '../../../infrastructure/http/http-content.repository';
import { OfflineDetectionService, VisitedPagesService } from '../../../infrastructure/offline';
import { ImageOverlayComponent } from '../../components/image-overlay/image-overlay.component';
import { LeafletMapComponent } from '../../components/leaflet-map/leaflet-map.component';
import { AnchorScrollService } from '../../services/anchor-scroll.service';
import type { LeafletLogSink } from '../../services/leaflet-injection.service';
import { LeafletInjectionService } from '../../services/leaflet-injection.service';

@Component({
  standalone: true,
  selector: 'app-viewer',
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.scss'],
  imports: [MatIconModule, MatTooltipModule, ImageOverlayComponent],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewerComponent implements OnDestroy {
  @ViewChild('contentEl', { static: true }) contentEl?: ElementRef<HTMLElement>;
  @ViewChild('tooltipTarget', { read: MatTooltip }) tooltip?: MatTooltip;
  @ViewChild('tooltipTarget', { read: ElementRef }) tooltipTarget?: ElementRef<HTMLElement>;
  @ViewChild(ImageOverlayComponent) imageOverlay?: ImageOverlayComponent;

  title = signal<string>('');
  readonly tooltipMessage = UNAVAILABLE_INTERNAL_PAGE_MESSAGE;

  // Signal pour les blocs Leaflet de la page actuelle
  leafletBlocks = signal<LeafletBlock[]>([]);

  // Signal pour la route actuelle (utilisé pour les breadcrumbs)
  currentRoute = signal<string>('/');

  // Signal pour indiquer qu'on attend un scroll vers un fragment
  private readonly pendingScrollFragment = signal<string | null>(null);

  private readonly cleanupFns: Array<() => void> = [];
  private readonly leafletComponentRefs = new Map<HTMLElement, ComponentRef<LeafletMapComponent>>();
  private readonly injector = inject(Injector);
  private postRenderCycle = 0;
  private isDestroyed = false;
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly leafletService = inject(LeafletInjectionService);

  // Injected services for offline support
  private readonly visitedPagesService = inject(VisitedPagesService);
  private readonly offlineService = inject(OfflineDetectionService);

  // Injected service for anchor scrolling
  private readonly anchorScrollService = inject(AnchorScrollService);

  // Flux réactif moderne avec toSignal (Angular 20 pattern)
  private readonly rawHtml = toSignal(
    this.router.events.pipe(
      startWith(null),
      map(() => this.router.url.split('?')[0].split('#')[0]),
      distinctUntilChanged(),
      switchMap((routePath) => {
        const normalized = this.normalizeRoute(routePath);
        const htmlUrl = normalized === '/' ? '/index.html' : `${normalized}.html`;

        // Update currentRoute for breadcrumbs
        this.currentRoute.set(normalized);

        return from(this.contentRepository.fetch(htmlUrl)).pipe(
          tap(() => {
            // Record successful page visit for offline access
            const pageTitle = this.title();
            if (pageTitle && normalized !== '/') {
              this.visitedPagesService.recordVisit(normalized.slice(1), pageTitle, normalized);
            }
          }),
          catchError(() => {
            // If offline and fetch fails, redirect to offline page
            if (this.offlineService.isOffline) {
              void this.router.navigate(['/offline']);
              return of('');
            }
            // If online but fetch failed, show error
            return of(
              '<div class="error-container"><p>Impossible de charger cette page.</p></div>'
            );
          })
        );
      })
    ),
    { initialValue: 'Chargement...' }
  );

  // HTML sanitizé calculable
  html = computed<SafeHtml>(() => {
    const raw = this.rawHtml();
    if (!raw || raw === 'Chargement...') {
      return this.sanitizer.bypassSecurityTrustHtml('Chargement...');
    }
    return this.sanitizer.bypassSecurityTrustHtml(raw);
  });

  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly contentRepository: HttpContentRepository,
    private readonly router: Router,
    private readonly sanitizer: DomSanitizer,
    private readonly catalog: CatalogFacade,
    private readonly environmentInjector: EnvironmentInjector
  ) {
    effect(() => {
      const manifest = this.catalog.manifest();
      const route = this.currentRoute();
      const page = manifest.pages.find((candidate) => candidate.route === route);

      if (!page) {
        this.title.set('');
        this.leafletBlocks.set([]);
        return;
      }

      this.title.set(this.capitalize(page.title) ?? '');
      this.leafletBlocks.set(page.leafletBlocks ?? []);
    });

    // Effect pour décorer le DOM après chargement
    effect(() => {
      this.html();
      this.leafletBlocks();
      const cycle = ++this.postRenderCycle;
      afterNextRender(
        () => {
          if (this.isDestroyed || cycle !== this.postRenderCycle) return;
          this.decorateWikilinks();
          this.decorateImages();
          this.injectLeafletComponents();
          this.scrollToFragmentIfPending();
        },
        { injector: this.injector }
      );
    });

    // Gérer le scroll vers fragment lors de navigation (deep links)
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        const fragment = this.extractFragmentFromUrl(event.urlAfterRedirects);
        if (fragment) {
          this.pendingScrollFragment.set(fragment);
        }
      });
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.cleanupWikilinks();
    this.cleanupImages();
    this.cleanupLeafletComponents();
    this.tooltip?.hide();
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private normalizeRoute(routePath: string): string {
    return routePath.replace(/\/+$/, '') || '/';
  }

  private decorateWikilinks(): void {
    this.cleanupWikilinks();

    const container = this.contentEl?.nativeElement;
    if (!container) return;

    // Intercepter TOUS les liens internes (y compris ceux des index générés par l'API)
    const allLinks = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'));
    for (const link of allLinks) {
      const href = link.getAttribute('href');
      if (!href) continue;

      // Détecter les liens externes
      const isExternal = /^[a-z]+:\/\//i.test(href) || href.startsWith('mailto:');
      if (isExternal) continue;

      // Intercepter tous les liens internes pour utiliser le router
      const clickHandler = (event: Event) => this.handleInternalLinkClick(event, link);
      link.addEventListener('click', clickHandler);
      this.cleanupFns.push(() => link.removeEventListener('click', clickHandler));
    }

    // Gestion spécifique des wikilinks non résolus
    const unresolvedLinks = Array.from(
      container.querySelectorAll<HTMLElement>('.wikilink-unresolved')
    );
    for (const link of unresolvedLinks) {
      const preventAndShow = (event: Event) => {
        event.preventDefault();
        this.showTooltip(event);
      };
      const show = (event: Event) => this.showTooltip(event);
      const hide = () => this.hideTooltip();
      const showFromKeyboard = (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }

        event.preventDefault();
        this.showTooltip(event);
      };

      link.addEventListener('click', preventAndShow);
      link.addEventListener('mouseenter', show);
      link.addEventListener('focus', show);
      link.addEventListener('keydown', showFromKeyboard);
      link.addEventListener('mouseleave', hide);
      link.addEventListener('blur', hide);

      this.cleanupFns.push(() => {
        link.removeEventListener('click', preventAndShow);
        link.removeEventListener('mouseenter', show);
        link.removeEventListener('focus', show);
        link.removeEventListener('keydown', showFromKeyboard);
        link.removeEventListener('mouseleave', hide);
        link.removeEventListener('blur', hide);
      });
    }
  }

  private cleanupWikilinks(): void {
    while (this.cleanupFns.length > 0) {
      const fn = this.cleanupFns.pop();
      fn?.();
    }
  }

  private handleInternalLinkClick(event: Event, link: HTMLAnchorElement): void {
    const href = link.getAttribute('href');
    if (!href) return;

    const isExternal = /^[a-z]+:\/\//i.test(href) || href.startsWith('mailto:');
    if (isExternal) return;

    // Handle fragment-only links (footnotes, heading anchors) sur la même page
    if (href.startsWith('#')) {
      event.preventDefault();
      const targetId = href.substring(1);
      // Use AnchorScrollService for SSR-safe scrolling
      void this.anchorScrollService.navigateToAnchor(targetId);
      return;
    }

    // Check if this is a link to the current page with a different fragment
    if (this.anchorScrollService.isCurrentPageLink(href)) {
      event.preventDefault();
      const [, fragment] = href.split('#');
      if (fragment) {
        void this.anchorScrollService.navigateToAnchor(fragment);
      }
      return;
    }

    event.preventDefault();

    // Extraire le path et le fragment du href
    const [path, fragment] = href.split('#');

    // Si le lien contient un fragment, le marquer comme pending
    if (fragment) {
      this.pendingScrollFragment.set(fragment);
    } else {
      this.pendingScrollFragment.set(null);
    }

    // Naviguer vers la nouvelle page (le fragment sera géré après le rendu)
    void this.router.navigateByUrl(path);
  }

  /**
   * Extrait le fragment d'une URL complète
   */
  private extractFragmentFromUrl(url: string): string | null {
    const hashIndex = url.indexOf('#');
    return hashIndex >= 0 ? url.substring(hashIndex + 1) : null;
  }

  /**
   * Scroll vers un élément par son ID (SSR-safe)
   */
  private scrollToElement(elementId: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    void this.anchorScrollService.scrollToAnchor(elementId);
  }

  /**
   * Tente de scroller vers le fragment pending si présent
   * Appelé après que le contenu HTML est injecté dans le DOM
   * Utilise AnchorScrollService pour une gestion SSR-safe et robuste
   */
  private scrollToFragmentIfPending(): void {
    const fragment = this.pendingScrollFragment();
    if (!fragment) return;

    if (!isPlatformBrowser(this.platformId)) {
      this.pendingScrollFragment.set(null);
      return;
    }

    // Use AnchorScrollService which handles MutationObserver and retry logic
    void this.anchorScrollService.scrollToAnchor(fragment).then(() => {
      this.pendingScrollFragment.set(null);
    });
  }

  private showTooltip(event: Event): void {
    const target = event.currentTarget as HTMLElement | null;
    if (!target) return;

    const message =
      target.getAttribute('title') ?? target.dataset['tooltip'] ?? this.tooltipMessage;
    this.updateTooltipAnchor(target, message);
    target.removeAttribute('title');
  }

  private hideTooltip(): void {
    this.tooltip?.hide();
  }

  private updateTooltipAnchor(target: HTMLElement, message: string): void {
    if (!this.tooltip || !this.tooltipTarget) return;

    const proxy = this.tooltipTarget.nativeElement;
    const rect = target.getBoundingClientRect();

    proxy.style.position = 'fixed';
    proxy.style.left = `${rect.left}px`;
    proxy.style.top = `${rect.top}px`;
    proxy.style.width = `${Math.max(rect.width, 1)}px`;
    proxy.style.height = `${Math.max(rect.height, 1)}px`;
    proxy.style.pointerEvents = 'none';
    proxy.style.opacity = '0';

    this.tooltip.message = message || this.tooltipMessage;
    this.tooltip.show();
  }

  private decorateImages(): void {
    this.cleanupImages();

    const container = this.contentEl?.nativeElement;
    if (!container) return;

    const images = Array.from(container.querySelectorAll<HTMLImageElement>('img'));
    for (const img of images) {
      img.style.cursor = 'pointer';
      const clickHandler = () => this.openImageOverlay(img);
      img.addEventListener('click', clickHandler);
      this.cleanupFns.push(() => img.removeEventListener('click', clickHandler));
    }
  }

  private cleanupImages(): void {
    // Cleanup is handled by cleanupWikilinks which clears the same cleanupFns array
  }
  private openImageOverlay(img: HTMLImageElement): void {
    if (!this.imageOverlay) return;
    const src = img.src;
    const alt = img.alt || '';
    this.imageOverlay.open(src, alt);
  }

  /**
   * Injecte dynamiquement les composants Leaflet dans les placeholders HTML.
   * Résolution métier : manifest signal → blocksById lookup.
   */
  private injectLeafletComponents(): void {
    if (!this.leafletService.canRun) return;

    const container = this.contentEl?.nativeElement;
    if (!container) return;

    const blocks = this.leafletBlocks();
    const placeholders = this.leafletService.findPlaceholders(container, '[data-leaflet-map-id]');

    // Handle case where manifest blocks are not yet available
    if (blocks.length === 0 && placeholders.length > 0) {
      this.leafletLog.info('leaflet-blocks-missing', {
        category: 'data',
        placeholdersFound: placeholders.length,
      });
      return;
    }

    const blocksById = new Map(blocks.map((b) => [b.id, b]));

    this.leafletService.runInjectionPass({
      placeholders,
      resolveBlock: (ph) => this.resolveBlockFromManifest(ph, blocksById),
      environmentInjector: this.environmentInjector,
      refs: this.leafletComponentRefs,
      log: this.leafletLog,
    });
  }

  /** Viewer-specific: resolve block from manifest signal */
  private resolveBlockFromManifest(
    placeholder: HTMLElement,
    blocksById: Map<string, LeafletBlock>
  ): { ok: true; block: LeafletBlock; mapId: string } | { ok: false; reason: string } {
    const mapId = placeholder.dataset['leafletMapId'];
    if (!mapId) {
      return { ok: false, reason: 'missing-map-id' };
    }
    const block = blocksById.get(mapId);
    if (!block) {
      this.leafletLog.warn('missing-block-for-placeholder', {
        category: 'data',
        mapId,
      });
      return { ok: false, reason: `missing-block-for-map-id:${mapId}` };
    }
    return { ok: true, block, mapId };
  }

  private cleanupLeafletComponents(): void {
    this.leafletService.destroyAll(this.leafletComponentRefs, this.leafletLog);
  }

  // ---------------------------------------------------------------------------
  // Leaflet log sink (preserves component-specific prefix)
  // ---------------------------------------------------------------------------

  private readonly leafletLog: LeafletLogSink = {
    info: (event, data) => {
      if (!this.isLeafletVerboseLoggingEnabled()) return;
      console.info('[ViewerComponent][Leaflet]', {
        event,
        route: this.currentRoute(),
        ...data,
      });
    },
    warn: (event, data) => {
      console.warn('[ViewerComponent][Leaflet]', {
        event,
        route: this.currentRoute(),
        ...data,
      });
    },
    error: (event, data) => {
      console.error('[ViewerComponent][Leaflet]', {
        event,
        route: this.currentRoute(),
        ...data,
      });
    },
  };

  private isLeafletVerboseLoggingEnabled(): boolean {
    if (!this.isBrowser) return false;
    try {
      return (
        globalThis.window.localStorage.getItem('vps:leaflet:debug') === '1' ||
        globalThis.window.localStorage.getItem('leaflet:debug') === '1'
      );
    } catch {
      return false;
    }
  }
}
