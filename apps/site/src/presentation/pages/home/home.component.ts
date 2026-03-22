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
  inject,
  Injector,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import type { LeafletBlock, ManifestPage } from '@core-domain';
import { from } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { CatalogFacade } from '../../../application/facades/catalog-facade';
import { ConfigFacade } from '../../../application/facades/config-facade';
import type { ContentRepository } from '../../../domain/ports/content-repository.port';
import { CONTENT_REPOSITORY } from '../../../domain/ports/tokens';
import { LeafletMapComponent } from '../../components/leaflet-map/leaflet-map.component';
import type { LeafletLogSink } from '../../services/leaflet-injection.service';
import { LeafletInjectionService } from '../../services/leaflet-injection.service';

type Section = {
  key: string;
  title: string;
  count: number;
  link: { segments: string[]; disabled?: boolean };
};

@Component({
  standalone: true,
  selector: 'app-home',
  imports: [MatDividerModule, MatCardModule, MatListModule, MatButtonModule],
  templateUrl: `./home.component.html`,
  styleUrls: [`./home.component.scss`],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit, OnDestroy {
  @ViewChild('contentEl', { static: false }) contentEl?: ElementRef<HTMLElement>;

  private readonly cleanupFns: Array<() => void> = [];
  private readonly leafletComponentRefs = new Map<HTMLElement, ComponentRef<LeafletMapComponent>>();
  private readonly platformId = inject(PLATFORM_ID);
  private readonly injector = inject(Injector);
  private readonly leafletService = inject(LeafletInjectionService);
  private postRenderCycle = 0;
  private isDestroyed = false;

  welcomeTitle = computed(() => {
    const cfg = this.config.cfg();
    return cfg?.homeWelcomeTitle;
  });

  // Chargement réactif de l'index HTML avec toSignal
  rootIndexHtml = toSignal(
    from(this.contentRepo.fetch('/index.html')).pipe(
      map((html) => this.sanitizer.bypassSecurityTrustHtml(html)),
      catchError(() => [this.sanitizer.bypassSecurityTrustHtml('<p>Index introuvable.</p>')])
    ),
    { initialValue: this.sanitizer.bypassSecurityTrustHtml('') }
  );

  constructor(
    public catalog: CatalogFacade,
    private readonly config: ConfigFacade,
    @Inject(CONTENT_REPOSITORY) private readonly contentRepo: ContentRepository,
    private readonly sanitizer: DomSanitizer,
    private readonly router: Router,
    private readonly environmentInjector: EnvironmentInjector
  ) {
    // Effect pour décorer les liens après chargement du HTML
    effect(() => {
      this.rootIndexHtml();
      const cycle = ++this.postRenderCycle;
      afterNextRender(
        () => {
          if (this.isDestroyed || cycle !== this.postRenderCycle) return;
          this.decorateLinks();
          this.injectLeafletComponents();
        },
        { injector: this.injector }
      );
    });
  }

  ngOnInit(): void {
    void this.catalog.ensureManifest();
    void this.config.ensure();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.cleanupLinks();
    this.cleanupLeafletComponents();
  }

  private decorateLinks(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.cleanupLinks();

    const container = this.contentEl?.nativeElement;
    if (!container) return;

    // Intercepter tous les liens internes
    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'));
    for (const link of links) {
      const href = link.getAttribute('href');
      if (!href) continue;

      // Détecter les liens externes
      const isExternal = /^[a-z]+:\/\//i.test(href) || href.startsWith('mailto:');
      if (isExternal) continue;

      // Intercepter les liens internes pour utiliser le router
      const clickHandler = (event: Event) => this.handleInternalLinkClick(event, link);
      link.addEventListener('click', clickHandler);
      this.cleanupFns.push(() => link.removeEventListener('click', clickHandler));
    }
  }

  private cleanupLinks(): void {
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

    event.preventDefault();
    void this.router.navigateByUrl(href);
  }

  /**
   * Injecte dynamiquement les composants Leaflet dans les placeholders HTML de l'index custom.
   * Résolution métier : JSON embarqué dans data-leaflet-block.
   */
  private injectLeafletComponents(): void {
    if (!this.leafletService.canRun) return;

    const container = this.contentEl?.nativeElement;
    if (!container) return;

    const placeholders = this.leafletService.findPlaceholders(container, '[data-leaflet-block]');

    this.leafletService.runInjectionPass({
      placeholders,
      resolveBlock: (ph) => this.resolveBlockFromDataset(ph),
      environmentInjector: this.environmentInjector,
      refs: this.leafletComponentRefs,
      log: this.leafletLog,
    });
  }

  /** Home-specific: parse block JSON from data-leaflet-block attribute */
  private resolveBlockFromDataset(
    placeholder: HTMLElement
  ): { ok: true; block: LeafletBlock; mapId: string } | { ok: false; reason: string } {
    const blockDataStr = placeholder.dataset['leafletBlock'];
    if (!blockDataStr) {
      return { ok: false, reason: 'missing-leaflet-block-dataset' };
    }

    try {
      const block: LeafletBlock = JSON.parse(blockDataStr);
      if (!block.id) {
        this.leafletLog.warn('placeholder-data-invalid', {
          category: 'data',
          reason: 'invalid-block-missing-id',
        });
        return { ok: false, reason: 'invalid-block-missing-id' };
      }
      return { ok: true, block, mapId: block.id };
    } catch (error) {
      this.leafletLog.error('leaflet-block-parse-failed', {
        category: 'data',
        error,
        blockDataStr,
      });
      return { ok: false, reason: 'invalid-leaflet-block-json' };
    }
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
      // eslint-disable-next-line no-console
      console.info('[HomeComponent][Leaflet]', { event, ...data });
    },
    warn: (event, data) => {
      // eslint-disable-next-line no-console
      console.warn('[HomeComponent][Leaflet]', { event, ...data });
    },
    error: (event, data) => {
      // eslint-disable-next-line no-console
      console.error('[HomeComponent][Leaflet]', { event, ...data });
    },
  };

  private isLeafletVerboseLoggingEnabled(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    try {
      return (
        globalThis.window.localStorage.getItem('vps:leaflet:debug') === '1' ||
        globalThis.window.localStorage.getItem('leaflet:debug') === '1'
      );
    } catch {
      return false;
    }
  }

  sections = computed<Section[]>(() => {
    const manifest = this.catalog.manifest();
    const pages: ManifestPage[] = manifest?.pages ?? [];

    if (pages.length === 0) {
      return [];
    }

    const groups = new Map<string, { landing?: ManifestPage; children: ManifestPage[] }>();

    for (const p of pages) {
      const route: string = p.route ?? '';
      const clean = route.replaceAll(/^\/+|\/+$/g, '');
      const [key, ...rest] = clean.split('/');
      if (!key) continue;

      if (!groups.has(key)) {
        groups.set(key, { landing: undefined, children: [] });
      }

      const g = groups.get(key)!;

      if (rest.length === 0) {
        g.landing = p;
      } else {
        g.children.push(p);
      }
    }

    const list: Section[] = [];

    for (const [key, g] of groups.entries()) {
      const landing = g.landing;
      const title = capitalize(landing?.title ?? key);

      let link: Section['link'] = { segments: [], disabled: true };
      if (landing?.route) {
        link = { segments: [landing.route] };
      } else if (g.children[0]?.route) {
        link = { segments: [g.children[0].route] };
      }

      list.push({
        key,
        title,
        count: (g.children?.length ?? 0) + (landing ? 1 : 0),
        link,
      });
    }

    return list.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
  });
}

function capitalize(s: string) {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
