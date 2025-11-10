import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CatalogFacade } from '../../application/facades/CatalogFacade';
import { ConfigFacade } from '../../application/facades/ConfigFacade';
import { VaultExplorerComponent } from '../components/vault-explorer/vault-explorer.component';
import { LogoComponent } from '../pages/logo/logo.component';
import { TopbarComponent } from '../pages/topbar/topbar.component';
import { ThemeService } from '../services/theme.service';

type Crumb = { label: string; url: string };

@Component({
  standalone: true,
  selector: 'app-shell',
  imports: [
    CommonModule,
    RouterOutlet,
    RouterOutlet,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    VaultExplorerComponent,
    TopbarComponent,
    LogoComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
})
export class ShellComponent implements OnInit {
  theme = inject(ThemeService);
  private readonly config = inject(ConfigFacade);
  private readonly catalog = inject(CatalogFacade);
  private readonly router = inject(Router);

  author = () => this.config.cfg()?.author ?? '';
  siteName = () => this.config.cfg()?.siteName ?? '';
  repo = () => this.config.cfg()?.repoUrl ?? '';

  currentTitle = '';

  private _crumbs: Crumb[] = [];
  crumbs = () => this._crumbs;

  async ngOnInit() {
    this.theme.init();
    await this.config.ensure();
    await this.catalog.ensureManifest?.();

    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => this.updateFromUrl());
    this.updateFromUrl();
  }

  private updateFromUrl() {
    const url = this.router.url.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';

    const m = url.match(/^\/p\/(.+)$/);
    if (!m) {
      this._crumbs = [];
      this.currentTitle = '';
      return;
    }

    const parts = m[1].split('/').filter(Boolean);
    this._crumbs = parts.map((seg, i) => ({
      label: decodeURIComponent(seg),
      url: '/p/' + parts.slice(0, i + 1).join('/'),
    }));

    const manifest = this.catalog.manifest?.();
    if (manifest?.pages?.length) {
      const page = manifest.pages.find((p) => p.route === url);
      this.currentTitle = page?.title ?? decodeURIComponent(parts[parts.length - 1] || '');
    } else {
      this.currentTitle = decodeURIComponent(parts[parts.length - 1] || '');
    }
  }
}
