import {
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  computed,
  createComponent,
  effect,
  ElementRef,
  EnvironmentInjector,
  Inject,
  OnDestroy,
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
import { distinctUntilChanged, filter, map, switchMap } from 'rxjs';

import { CatalogFacade } from '../../../application/facades/catalog-facade';
import { CONTENT_REPOSITORY } from '../../../domain/ports/tokens';
import { HttpContentRepository } from '../../../infrastructure/http/http-content.repository';
import { ImageOverlayComponent } from '../../components/image-overlay/image-overlay.component';
import { LeafletMapComponent } from '../../components/leaflet-map/leaflet-map.component';

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
  readonly tooltipMessage = 'Cette page arrive prochainement';

  // Signal pour les blocs Leaflet de la page actuelle
  leafletBlocks = signal<LeafletBlock[]>([]);

  // Signal pour la route actuelle (utilisé pour les breadcrumbs)
  currentRoute = signal<string>('/');

  // Signal pour indiquer qu'on attend un scroll vers un fragment
  private readonly pendingScrollFragment = signal<string | null>(null);

  private readonly cleanupFns: Array<() => void> = [];
  private readonly leafletComponentRefs: ComponentRef<LeafletMapComponent>[] = [];

  // Flux réactif moderne avec toSignal (Angular 20 pattern)
  private readonly rawHtml = toSignal(
    this.router.events.pipe(
      map(() => this.router.url.split('?')[0].split('#')[0]),
      distinctUntilChanged(),
      switchMap((routePath) => {
        const normalized = routePath.replace(/\/+$/, '') || '/';
        const htmlUrl = normalized === '/' ? '/index.html' : `${normalized}.html`;
        const manifest = this.catalog.manifest();

        // Update currentRoute for breadcrumbs
        this.currentRoute.set(normalized);

        if (manifest.pages.length > 0) {
          const p = manifest.pages.find((x) => x.route === normalized);
          if (p) {
            this.title.set(this.capitalize(p.title) ?? '');
            // Mettre à jour les blocs Leaflet si présents
            const leafletBlocks = p.leafletBlocks ?? [];
            this.leafletBlocks.set(leafletBlocks);
          } else {
            this.leafletBlocks.set([]);
          }
        } else {
          this.leafletBlocks.set([]);
        }

        return this.contentRepository.fetch(htmlUrl);
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
    // Effect pour décorer le DOM après chargement
    effect(() => {
      this.html();
      setTimeout(() => {
        this.decorateWikilinks();
        this.decorateImages();
        this.injectLeafletComponents();
        this.scrollToFragmentIfPending();
      });
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
    this.cleanupWikilinks();
    this.cleanupImages();
    this.cleanupLeafletComponents();
    this.tooltip?.hide();
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
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
      const prevent = (event: Event) => event.preventDefault();
      const show = (event: Event) => this.showTooltip(event);
      const hide = () => this.hideTooltip();

      link.addEventListener('click', prevent);
      link.addEventListener('mouseenter', show);
      link.addEventListener('focus', show);
      link.addEventListener('mouseleave', hide);
      link.addEventListener('blur', hide);

      this.cleanupFns.push(() => {
        link.removeEventListener('click', prevent);
        link.removeEventListener('mouseenter', show);
        link.removeEventListener('focus', show);
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
      this.scrollToElement(targetId);
      // Update URL without navigation
      globalThis.history.pushState(null, '', `${globalThis.location.pathname}${href}`);
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
   * Scroll vers un élément par son ID
   */
  private scrollToElement(elementId: string): void {
    const targetElement = document.getElementById(elementId);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /**
   * Tente de scroller vers le fragment pending si présent
   * Appelé après que le contenu HTML est injecté dans le DOM
   */
  private scrollToFragmentIfPending(): void {
    const fragment = this.pendingScrollFragment();
    if (!fragment) return;

    // Stratégie de retry bornée car le DOM peut ne pas être immédiatement prêt
    let attempts = 0;
    const maxAttempts = 5;

    const tryScroll = () => {
      attempts++;
      const targetElement = document.getElementById(fragment);

      if (targetElement) {
        // Élément trouvé, on scroll
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        this.pendingScrollFragment.set(null);
        return;
      }

      // Si pas trouvé et qu'on a encore des tentatives, réessayer après un frame
      if (attempts < maxAttempts) {
        requestAnimationFrame(tryScroll);
      } else {
        // Abandon après maxAttempts
        this.pendingScrollFragment.set(null);
      }
    };

    // Démarrer la première tentative après un frame (pour laisser le DOM se mettre à jour)
    requestAnimationFrame(tryScroll);
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
   * Injecte dynamiquement les composants Leaflet dans les placeholders HTML
   */
  private injectLeafletComponents(): void {
    // Nettoyer les composants précédents
    this.cleanupLeafletComponents();

    const container = this.contentEl?.nativeElement;
    if (!container) return;

    const blocks = this.leafletBlocks();
    if (blocks.length === 0) return;

    // Créer un Map pour accès rapide par ID
    const blocksById = new Map(blocks.map((block) => [block.id, block]));

    // Trouver tous les placeholders dans le HTML
    const placeholders = Array.from(
      container.querySelectorAll<HTMLElement>('[data-leaflet-map-id]')
    );

    for (const placeholder of placeholders) {
      const mapId = placeholder.dataset['leafletMapId'];
      if (!mapId) continue;

      const block = blocksById.get(mapId);
      if (!block) {
        continue;
      }

      // Créer le composant dynamiquement
      const componentRef = createComponent(LeafletMapComponent, {
        environmentInjector: this.environmentInjector,
        hostElement: placeholder,
      });

      // Passer les données au composant
      componentRef.setInput('block', block);

      // Déclencher la détection de changement
      componentRef.changeDetectorRef.detectChanges();

      // Stocker la référence pour nettoyage ultérieur
      this.leafletComponentRefs.push(componentRef);
    }
  }

  /**
   * Nettoie les composants Leaflet injectés dynamiquement
   */
  private cleanupLeafletComponents(): void {
    for (const componentRef of this.leafletComponentRefs) {
      componentRef.destroy();
    }
    this.leafletComponentRefs.length = 0;
  }
}
