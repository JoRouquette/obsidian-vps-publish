import type { OnInit } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
// Angular Material
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import type { SafeHtml } from '@angular/platform-browser';
import { DomSanitizer } from '@angular/platform-browser';
import type { ManifestPage } from '@core-domain/entities/manifest-page';

import { CatalogFacade } from '../../../application/facades/catalog-facade';
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
export class HomeComponent implements OnInit {
  rootIndexHtml = signal<SafeHtml | null>(null);

  constructor(
    public catalog: CatalogFacade,
    @Inject(CONTENT_REPOSITORY) private readonly contentRepo: ContentRepository,
    private readonly sanitizer: DomSanitizer
  ) {
    void this.catalog.ensureManifest();
  }

  ngOnInit(): void {
    void this.contentRepo
      .fetch('/index.html')
      .then((html) => this.rootIndexHtml.set(this.sanitizer.bypassSecurityTrustHtml(html)))
      .catch(() =>
        this.rootIndexHtml.set(this.sanitizer.bypassSecurityTrustHtml('<p>Index introuvable.</p>'))
      );
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
