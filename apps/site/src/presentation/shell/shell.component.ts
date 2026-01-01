import { isPlatformBrowser, NgComponentOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  Inject,
  type OnInit,
  PLATFORM_ID,
  signal,
  type Type,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import type { ManifestPage } from '@core-domain';
import { humanizePropertyKey } from '@core-domain/utils/string.utils';
import { filter } from 'rxjs/operators';

import { CatalogFacade } from '../../application/facades/catalog-facade';
import { ConfigFacade } from '../../application/facades/config-facade';
import { SearchFacade } from '../../application/facades/search-facade';
import { SearchBarComponent } from '../components/search-bar/search-bar.component';
import { LogoComponent } from '../pages/logo/logo.component';
import { TopbarComponent } from '../pages/topbar/topbar.component';
import { ThemeService } from '../services/theme.service';

type Crumb = { label: string; url: string };

@Component({
  standalone: true,
  selector: 'app-shell',
  imports: [
    NgComponentOutlet,
    RouterOutlet,
    TopbarComponent,
    LogoComponent,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    SearchBarComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
})
export class ShellComponent implements OnInit {
  constructor(
    readonly theme: ThemeService,
    private readonly config: ConfigFacade,
    private readonly catalog: CatalogFacade,
    private readonly router: Router,
    public searchFacade: SearchFacade,
    private readonly destroyRef: DestroyRef,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  currentYear = new Date().getFullYear();
  lastNonSearchUrl = '/';
  isMenuOpen = signal(false);
  isSearchOverlayOpen = signal(false);

  // Sidebar collapse & resize state
  isSidebarCollapsed = signal(false);
  sidebarWidth = signal(280); // default width in px
  private isResizing = false;
  private startX = 0;
  private startWidth = 0;

  // Sidebar width constraints (in px)
  private readonly MIN_SIDEBAR_WIDTH = 200;
  private readonly MAX_SIDEBAR_WIDTH = 600;
  private readonly DEFAULT_SIDEBAR_WIDTH = 280;
  private readonly COLLAPSED_SIDEBAR_WIDTH = 0;

  author = () => this.config.cfg()?.author ?? '';
  siteName = () => this.config.cfg()?.siteName ?? '';
  repo = () => this.config.cfg()?.repoUrl ?? '';
  reportIssues = () => this.config.cfg()?.reportIssuesUrl ?? '';

  currentTitle = '';

  private _crumbs: Crumb[] = [];
  crumbs = () => this._crumbs;
  private readonly pageTitleCache = new Map<string, string>();
  private readonly pageByRoute = new Map<string, ManifestPage>();
  private readonly folderDisplayNameCache = new Map<string, string>();
  vaultExplorerComponent = signal<Type<unknown> | null>(null);

  ngOnInit(): void {
    this.theme.init();
    this.loadSidebarState();
    void this.config.ensure().then(async () => {
      await this.catalog.ensureManifest();
      await this.loadVaultExplorer();
      this.hydrateManifestCache();
      this.router.events
        .pipe(
          filter((e) => e instanceof NavigationEnd),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe(() => {
          this.updateFromUrl();
          // Close menu only when navigating to a file (not a folder/index)
          this.closeMenuIfNavigatingToFile();
        });

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
      const decodedSeg = decodeURIComponent(seg);

      // Try to get folder displayName from cache
      const folderDisplayName = this.folderDisplayNameCache.get(partial);

      return {
        url: page?.route ?? partial,
        label: page?.title ?? folderDisplayName ?? humanizePropertyKey(decodedSeg),
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
    this.folderDisplayNameCache.clear();
    const manifest = this.catalog.manifest?.();

    // First, populate folderDisplayNameCache from manifest.folderDisplayNames (route tree config)
    if (manifest?.folderDisplayNames) {
      Object.entries(manifest.folderDisplayNames).forEach(([routePath, displayName]) => {
        this.folderDisplayNameCache.set(this.normalizeRoute(routePath), displayName);
      });
    }

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
    if (this.vaultExplorerComponent()) return;
    const mod = await import('../components/vault-explorer/vault-explorer.component');
    this.vaultExplorerComponent.set(mod.VaultExplorerComponent);
  }

  toggleMenu(): void {
    this.isMenuOpen.update((v) => !v);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  toggleSearchOverlay(): void {
    this.isSearchOverlayOpen.update((v) => !v);
  }

  closeSearchOverlay(): void {
    this.isSearchOverlayOpen.set(false);
  }

  async onSearchSubmit(value: string): Promise<void> {
    await this.router.navigate(['/search'], { queryParams: { q: value } });
    this.closeSearchOverlay();
  }

  // === Sidebar collapse/expand ===
  toggleSidebarCollapse(): void {
    this.isSidebarCollapsed.update((v) => !v);
    this.saveSidebarState();
  }

  // === Sidebar resize ===
  startResize(event: MouseEvent | TouchEvent): void {
    if (!isPlatformBrowser(this.platformId)) return; // SSR protection

    event.preventDefault();
    this.isResizing = true;

    const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
    this.startX = clientX;
    this.startWidth = this.sidebarWidth();

    // Add global listeners
    document.addEventListener('mousemove', this.handleResize);
    document.addEventListener('mouseup', this.stopResize);
    document.addEventListener('touchmove', this.handleResize);
    document.addEventListener('touchend', this.stopResize);

    // Add cursor style
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  private handleResize = (event: MouseEvent | TouchEvent): void => {
    if (!this.isResizing) return;

    const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
    const delta = clientX - this.startX;
    const newWidth = this.startWidth + delta;

    // Clamp width between min and max
    const clampedWidth = Math.max(
      this.MIN_SIDEBAR_WIDTH,
      Math.min(this.MAX_SIDEBAR_WIDTH, newWidth)
    );

    this.sidebarWidth.set(clampedWidth);
  };

  private stopResize = (): void => {
    if (!this.isResizing) return;
    if (!isPlatformBrowser(this.platformId)) return; // SSR protection

    this.isResizing = false;

    // Remove global listeners
    document.removeEventListener('mousemove', this.handleResize);
    document.removeEventListener('mouseup', this.stopResize);
    document.removeEventListener('touchmove', this.handleResize);
    document.removeEventListener('touchend', this.stopResize);

    // Reset cursor
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Save new width
    this.saveSidebarState();
  };

  handleResizeKeyboard(event: KeyboardEvent): void {
    const step = 20; // px per keypress
    let newWidth = this.sidebarWidth();

    if (event.key === 'ArrowLeft') {
      newWidth -= step;
    } else if (event.key === 'ArrowRight') {
      newWidth += step;
    } else {
      return;
    }

    event.preventDefault();
    newWidth = Math.max(this.MIN_SIDEBAR_WIDTH, Math.min(this.MAX_SIDEBAR_WIDTH, newWidth));
    this.sidebarWidth.set(newWidth);
    this.saveSidebarState();
  }

  // === LocalStorage persistence ===
  private loadSidebarState(): void {
    if (!isPlatformBrowser(this.platformId)) return; // SSR protection

    try {
      const collapsed = localStorage.getItem('sidebar-collapsed');
      const width = localStorage.getItem('sidebar-width');

      if (collapsed !== null) {
        this.isSidebarCollapsed.set(collapsed === 'true');
      }

      if (width !== null) {
        const parsedWidth = parseInt(width, 10);
        if (!isNaN(parsedWidth)) {
          this.sidebarWidth.set(
            Math.max(this.MIN_SIDEBAR_WIDTH, Math.min(this.MAX_SIDEBAR_WIDTH, parsedWidth))
          );
        }
      }
    } catch {
      // localStorage not available or error - use defaults (silent fallback)
    }
  }

  private saveSidebarState(): void {
    if (!isPlatformBrowser(this.platformId)) return; // SSR protection

    try {
      localStorage.setItem('sidebar-collapsed', this.isSidebarCollapsed().toString());
      localStorage.setItem('sidebar-width', this.sidebarWidth().toString());
    } catch {
      // localStorage not available - silent fallback
    }
  }

  private closeMenuIfNavigatingToFile(): void {
    const url = this.router.url;
    const cleanUrl = url.split('?')[0].replace(/\/+$/, '') || '/';

    // Don't close menu for home, search, or index pages (folders)
    if (cleanUrl === '/' || cleanUrl.startsWith('/search') || cleanUrl.endsWith('/index')) {
      return;
    }

    // Close menu for actual file pages
    this.closeMenu();
  }
}
