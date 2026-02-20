import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  type Signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ManifestPage } from '@core-domain';

import { CatalogFacade } from '../../../application/facades/catalog-facade';

export interface RelatedSection {
  title: string;
  pages: ManifestPage[];
}

/**
 * Related Pages Component
 *
 * Displays internal links to related pages for improved SEO and navigation:
 * - Child pages: pages under the current route
 * - Sibling pages: pages at the same folder level
 * - Related by tags: pages sharing tags with current page
 *
 * Uses semantic HTML with appropriate heading hierarchy for accessibility.
 */
@Component({
  selector: 'app-related-pages',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './related-pages.component.html',
  styleUrls: ['./related-pages.component.scss'],
})
export class RelatedPagesComponent {
  private readonly catalog = inject(CatalogFacade);

  /** Current route path (e.g., '/docs/guide') */
  route = input.required<string>();

  /** Maximum pages per section */
  maxPerSection = input<number>(5);

  /** Current page from manifest */
  private readonly currentPage: Signal<ManifestPage | undefined> = computed(() => {
    const manifest = this.catalog.manifest();
    const currentRoute = this.route();
    return manifest.pages.find((p) => p.route === currentRoute);
  });

  /** Child pages: pages whose route starts with current route */
  private readonly childPages: Signal<ManifestPage[]> = computed(() => {
    const manifest = this.catalog.manifest();
    const currentRoute = this.route();
    const max = this.maxPerSection();

    if (currentRoute === '/') return [];

    const prefix = currentRoute + '/';
    return manifest.pages
      .filter((p) => p.route.startsWith(prefix) && !p.isCustomIndex && !p.noIndex)
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, max);
  });

  /** Sibling pages: pages at the same folder level */
  private readonly siblingPages: Signal<ManifestPage[]> = computed(() => {
    const manifest = this.catalog.manifest();
    const currentRoute = this.route();
    const max = this.maxPerSection();

    if (currentRoute === '/') return [];

    const parentPath = this.getParentPath(currentRoute);
    const siblingPrefix = parentPath === '/' ? '/' : parentPath + '/';

    return manifest.pages
      .filter((p) => {
        if (p.route === currentRoute) return false;
        if (p.isCustomIndex || p.noIndex) return false;
        // Must be direct child of parent (no additional slashes)
        if (!p.route.startsWith(siblingPrefix)) return false;
        const remaining = p.route.slice(siblingPrefix.length);
        return !remaining.includes('/');
      })
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, max);
  });

  /** Pages sharing tags with current page */
  private readonly relatedByTags: Signal<ManifestPage[]> = computed(() => {
    const manifest = this.catalog.manifest();
    const current = this.currentPage();
    const currentRoute = this.route();
    const max = this.maxPerSection();

    if (!current?.tags?.length) return [];

    const currentTags = new Set(current.tags);
    const childRoutes = new Set(this.childPages().map((p) => p.route));
    const siblingRoutes = new Set(this.siblingPages().map((p) => p.route));

    // Score pages by number of shared tags
    const scored = manifest.pages
      .filter((p) => {
        if (p.route === currentRoute) return false;
        if (p.isCustomIndex || p.noIndex) return false;
        if (childRoutes.has(p.route) || siblingRoutes.has(p.route)) return false;
        return p.tags?.some((t) => currentTags.has(t));
      })
      .map((p) => ({
        page: p,
        score: p.tags?.filter((t) => currentTags.has(t)).length ?? 0,
      }))
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, max).map((s) => s.page);
  });

  /** Combined sections for template */
  sections: Signal<RelatedSection[]> = computed(() => {
    const sections: RelatedSection[] = [];

    const children = this.childPages();
    if (children.length > 0) {
      sections.push({ title: 'Dans cette section', pages: children });
    }

    const siblings = this.siblingPages();
    if (siblings.length > 0) {
      sections.push({ title: 'Voir aussi', pages: siblings });
    }

    const byTags = this.relatedByTags();
    if (byTags.length > 0) {
      sections.push({ title: 'Pages connexes', pages: byTags });
    }

    return sections;
  });

  /** Whether to render anything */
  hasRelated: Signal<boolean> = computed(() => this.sections().some((s) => s.pages.length > 0));

  private getParentPath(route: string): string {
    const lastSlash = route.lastIndexOf('/');
    if (lastSlash <= 0) return '/';
    return route.slice(0, lastSlash);
  }
}
