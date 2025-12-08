import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  Inject,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
// Angular Material
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import type { ManifestPage } from '@core-domain/entities/manifest-page';
import { from } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { CatalogFacade } from '../../../application/facades/catalog-facade';
import { ConfigFacade } from '../../../application/facades/config-facade';
import type { ContentRepository } from '../../../domain/ports/content-repository.port';
import { CONTENT_REPOSITORY } from '../../../domain/ports/tokens';

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
export class HomeComponent {
  @ViewChild('contentEl', { static: false }) contentEl?: ElementRef<HTMLElement>;

  private readonly cleanupFns: Array<() => void> = [];

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
    private readonly router: Router
  ) {
    void this.catalog.ensureManifest();
    void this.config.ensure();

    // Effect pour décorer les liens après chargement du HTML
    effect(() => {
      this.rootIndexHtml();
      setTimeout(() => this.decorateLinks());
    });
  }

  ngOnDestroy(): void {
    this.cleanupLinks();
  }

  private decorateLinks(): void {
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

  sections = computed<Section[]>(() => {
    const manifest = this.catalog.manifest();
    const pages: ManifestPage[] = manifest?.pages ?? [];

    if (pages.length === 0) {
      return [];
    }

    const groups = new Map<
      string,
      { landing?: ManifestPage | undefined; children: ManifestPage[] }
    >();

    for (const p of pages) {
      const route: string = p.route ?? '';
      const clean = route.replace(/^\/+|\/+$/g, '');
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
