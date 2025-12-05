import { CommonModule } from '@angular/common';
import { Component, DestroyRef, type OnInit, type Type } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import type { ManifestPage } from '@core-domain';
import { filter } from 'rxjs/operators';

import { CatalogFacade } from '../../application/facades/catalog-facade';
import { ConfigFacade } from '../../application/facades/config-facade';
import { SearchFacade } from '../../application/facades/search-facade';
import { LogoComponent } from '../pages/logo/logo.component';
import { TopbarComponent } from '../pages/topbar/topbar.component';
import { ThemeService } from '../services/theme.service';

type Crumb = { label: string; url: string };

@Component({
  standalone: true,
  selector: 'app-shell',
  imports: [CommonModule, RouterOutlet, TopbarComponent, LogoComponent, MatIconModule],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
})
export class ShellComponent implements OnInit {
  constructor(
    readonly theme: ThemeService,
    private readonly config: ConfigFacade,
    private readonly catalog: CatalogFacade,
    private readonly router: Router,
    private readonly searchFacade: SearchFacade,
    private readonly destroyRef: DestroyRef
  ) {}

  currentYear = new Date().getFullYear();
  lastNonSearchUrl = '/';

  author = () => this.config.cfg()?.author ?? '';
  siteName = () => this.config.cfg()?.siteName ?? '';
  repo = () => this.config.cfg()?.repoUrl ?? '';
  reportIssues = () => this.config.cfg()?.reportIssuesUrl ?? '';

  currentTitle = '';

  private _crumbs: Crumb[] = [];
  crumbs = () => this._crumbs;
  private readonly pageTitleCache = new Map<string, string>();
  private readonly pageByRoute = new Map<string, ManifestPage>();
  vaultExplorerComponent: Type<unknown> | null = null;

  ngOnInit(): void {
    this.theme.init();
    void this.config.ensure().then(async () => {
      await this.catalog.ensureManifest();
      await this.loadVaultExplorer();
      this.hydrateManifestCache();
      this.router.events
        .pipe(
          filter((e) => e instanceof NavigationEnd),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe(() => this.updateFromUrl());

      this.updateFromUrl();
    });
  }

  private updateFromUrl() {
    const parsed = this.router.parseUrl(this.router.url);
    const url = parsed.root.children['primary']?.segments.map((s) => s.path).join('/') || '';
    const cleanUrl = ('/' + url).replace(/\/+$/, '') || '/';

    if (cleanUrl.startsWith('/search')) {
      const q = (parsed.queryParams?.['q'] as string) ?? '';
      if (q !== this.searchFacade.query()) {
        this.searchFacade.setQuery(q);
      }
      this._crumbs = [];
      this.currentTitle = 'Recherche';
      return;
    }

    // Leaving search: clear input
    if (this.searchFacade.query()) {
      this.searchFacade.setQuery('');
    }

    if (cleanUrl === '/') {
      this._crumbs = [];
      this.currentTitle = '';
      this.lastNonSearchUrl = '/';
      return;
    }

    this.lastNonSearchUrl = cleanUrl;

    const rawParts = cleanUrl.replace(/^\/+/, '').split('/').filter(Boolean);
    const parts = rawParts.at(-1) === 'index' ? rawParts.slice(0, -1) : rawParts;

    this._crumbs = parts.map((seg, i) => {
      const partial = this.normalizeRoute('/' + parts.slice(0, i + 1).join('/'));
      const page = this.findPageForRoute(partial);
      return {
        url: page?.route ?? partial,
        label: page?.title ?? decodeURIComponent(seg),
      };
    });

    const page = this.findPageForRoute(url);
    this.currentTitle = page?.title ?? decodeURIComponent(parts.at(-1) || '');
  }

  private normalizeRoute(route: string): string {
    const normalized = route.replace(/\/+$/, '') || '/';
    return normalized.startsWith('/') ? normalized : '/' + normalized;
  }

  private hydrateManifestCache(): void {
    this.pageTitleCache.clear();
    this.pageByRoute.clear();
    const manifest = this.catalog.manifest?.();
    manifest?.pages?.forEach((p) => {
      const key = this.normalizeRoute(p.route);
      this.pageTitleCache.set(key, p.title);
      this.pageByRoute.set(key, { ...p, route: key });
    });
  }

  private getPageTitle(route: string): string | undefined {
    if (this.pageTitleCache.size === 0) {
      this.hydrateManifestCache();
    }
    const normalized = this.normalizeRoute(route);
    return this.pageTitleCache.get(normalized);
  }

  private findPageForRoute(route: string): ManifestPage | undefined {
    if (this.pageByRoute.size === 0) {
      this.hydrateManifestCache();
    }

    const normalized = this.normalizeRoute(route);

    const exact = this.pageByRoute.get(normalized);
    if (exact) return exact;

    const indexRoute = this.normalizeRoute(normalized + '/index');
    const indexPage = this.pageByRoute.get(indexRoute);
    if (indexPage) return indexPage;

    if (normalized.endsWith('/index')) {
      const parent = this.normalizeRoute(normalized.replace(/\/index$/, '') || '/');
      const parentIndex = this.pageByRoute.get(this.normalizeRoute(parent + '/index'));
      if (parentIndex) return parentIndex;
    }

    return undefined;
  }

  private async loadVaultExplorer(): Promise<void> {
    if (this.vaultExplorerComponent) return;
    const mod = await import('../components/vault-explorer/vault-explorer.component');
    this.vaultExplorerComponent = mod.VaultExplorerComponent;
  }
}
