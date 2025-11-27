import { Component, computed } from '@angular/core';

// Angular Material
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';

import { CatalogFacade } from '../../../application/facades/catalog-facade';
import { ManifestPage } from '@core-domain/entities/manifest-page';

type Section = {
  key: string;
  title: string;
  count: number;
  link: { segments: any[]; disabled?: boolean };
};

@Component({
  standalone: true,
  selector: 'app-home',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatDividerModule,
    MatCardModule,
    MatListModule,
    MatButtonModule,
  ],
  templateUrl: `./home.component.html`,
  styleUrls: [`./home.component.scss`],
})
export class HomeComponent {
  constructor(public catalog: CatalogFacade) {
    this.catalog.ensureManifest();
  }

  onQueryInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.catalog.query.set(value);
  }

  sections = computed<Section[]>(() => {
    const manifest = this.catalog.manifest();
    const pages = manifest?.pages ?? [];

    if (pages.length === 0) {
      return [];
    }

    const groups = new Map<
      string,
      { landing?: ManifestPage | undefined; children: ManifestPage[] }
    >();

    for (const p of pages as ManifestPage[]) {
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
