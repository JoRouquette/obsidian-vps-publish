import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';

import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';

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
    // Material utilitaires (le topbar utilise son propre MatToolbar)
    MatDividerModule,
    MatIconModule,
    MatButtonModule,

    // Feature components
    VaultExplorerComponent,
    TopbarComponent,
    LogoComponent,
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
    private readonly destroyRef: DestroyRef
  ) {}

  currentYear = new Date().getFullYear();

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
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.updateFromUrl());

    this.updateFromUrl();
  }

  onCrumbClicked(crumb: Crumb) {
    this.router.navigateByUrl(crumb.url);
  }

  private updateFromUrl() {
    const url = this.router.url.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';

    if (url === '/') {
      this._crumbs = [];
      this.currentTitle = '';
      return;
    }

    const parts = url.replace(/^\/+/, '').split('/').filter(Boolean);

    this._crumbs = parts.map((seg, i) => ({
      label: decodeURIComponent(seg),
      url: '/' + parts.slice(0, i + 1).join('/'),
    }));

    const manifest = this.catalog.manifest?.();
    if (manifest?.pages?.length) {
      const page = manifest.pages.find((p) => p.route === url);
      this.currentTitle = page?.title ?? decodeURIComponent(parts.at(-1) || '');
    } else {
      this.currentTitle = decodeURIComponent(parts.at(-1) || '');
    }
  }
}
