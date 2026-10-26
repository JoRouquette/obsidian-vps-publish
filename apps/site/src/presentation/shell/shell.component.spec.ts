import { Component, Input, PLATFORM_ID, signal } from '@angular/core';
import { DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { Manifest } from '@core-domain';
import { Slug } from '@core-domain';

import { CatalogFacade } from '../../application/facades/catalog-facade';
import { ConfigFacade } from '../../application/facades/config-facade';
import { SearchFacade } from '../../application/facades/search-facade';
import { PwaMetaService } from '../../infrastructure/pwa/pwa-meta.service';
import { ScrollToTopComponent } from '../components/scroll-to-top/scroll-to-top.component';
import { LogoComponent } from '../pages/logo/logo.component';
import { TopbarComponent } from '../pages/topbar/topbar.component';
import { ThemeService } from '../services/theme.service';
import { ShellComponent } from './shell.component';

jest.mock('../../application/facades/catalog-facade', () => ({
  CatalogFacade: class MockCatalogFacade {},
}));

jest.mock('../../application/facades/config-facade', () => ({
  ConfigFacade: class MockConfigFacade {},
}));

jest.mock('../../application/facades/search-facade', () => ({
  SearchFacade: class MockSearchFacade {},
}));

jest.mock('../components/vault-explorer/vault-explorer.component', () => {
  const { Component: StubComponent } =
    jest.requireActual<typeof import('@angular/core')>('@angular/core');

  @StubComponent({ selector: 'app-vault-explorer', standalone: true, template: '' })
  class StubVaultExplorerComponent {}

  return { VaultExplorerComponent: StubVaultExplorerComponent };
});

@Component({
  selector: 'app-topbar',
  standalone: true,
  template: `@for (c of crumbs; track c.url) {
    <span class="crumb">{{ c.label }}</span>
  }`,
})
class StubTopbarComponent {
  @Input() siteName = '';
  @Input() crumbs: Array<{ label: string; url: string }> = [];
  @Input() isDark = false;
  @Input() lastVisited = '/';
}

@Component({ selector: 'app-logo', standalone: true, template: '' })
class StubLogoComponent {}

@Component({ selector: 'app-scroll-to-top', standalone: true, template: '' })
class StubScrollToTopComponent {}

@Component({ standalone: true, template: '' })
class DummyRouteComponent {}

function parseUrl(url: string) {
  const [pathname, queryString] = url.split('?');
  const queryParams = Object.fromEntries(new URLSearchParams(queryString ?? ''));
  const segments = pathname
    .split('/')
    .filter(Boolean)
    .map((path) => ({ path }));

  return {
    root: {
      children: {
        primary: {
          segments,
        },
      },
    },
    queryParams,
  };
}

describe('ShellComponent breadcrumbs', () => {
  function createComponent(manifest: Manifest, url: string): ShellComponent {
    const router = {
      url,
      parseUrl,
    };

    return new ShellComponent(
      { init: jest.fn() } as any,
      { cfg: () => ({}) } as any,
      { manifest: () => manifest } as any,
      router as any,
      { query: () => '', setQuery: jest.fn() } as any,
      {} as any,
      { init: jest.fn() } as any,
      'browser'
    );
  }

  it('uses manifest folder display names for breadcrumb labels while targeting folder index routes', () => {
    const manifest: Manifest = {
      sessionId: 'session-1',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      folderDisplayNames: {
        '/tresors': 'Trésors',
        '/tresors/chroniques-d-ete': "Chroniques d'Été",
      },
      pages: [
        {
          id: 'page-1',
          title: 'Page Note',
          route: '/tresors/chroniques-d-ete/page-note',
          slug: Slug.from('page-note'),
          publishedAt: new Date(),
        },
      ],
    };

    const component = createComponent(manifest, '/tresors/chroniques-d-ete/page-note');

    (component as any).hydrateManifestCache();
    (component as any).updateFromUrl();

    expect(component.crumbs()).toEqual([
      { label: 'Trésors', url: '/tresors/index' },
      { label: "Chroniques d'Été", url: '/tresors/chroniques-d-ete/index' },
      { label: 'Page Note', url: '/tresors/chroniques-d-ete/page-note' },
    ]);
  });

  it('keeps nested folder index breadcrumbs navigable on their published index routes', () => {
    const manifest: Manifest = {
      sessionId: 'session-1',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      folderDisplayNames: {
        '/ektaron': 'Ektaron',
        '/ektaron/aegasos': 'Aegasos',
        '/ektaron/aegasos/belienne': 'Belienne',
      },
      pages: [],
    };

    const component = createComponent(manifest, '/ektaron/aegasos/belienne/index');

    (component as any).hydrateManifestCache();
    (component as any).updateFromUrl();

    expect(component.crumbs()).toEqual([
      { label: 'Ektaron', url: '/ektaron/index' },
      { label: 'Aegasos', url: '/ektaron/aegasos/index' },
      { label: 'Belienne', url: '/ektaron/aegasos/belienne/index' },
    ]);
  });
});

describe('ShellComponent rendering under OnPush', () => {
  it('repaints breadcrumbs when navigating between routes served by the same component', async () => {
    TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideRouter([{ path: '**', component: DummyRouteComponent }]),
        { provide: ThemeService, useValue: { init: jest.fn(), isDark: signal(false) } },
        { provide: ConfigFacade, useValue: { cfg: signal(null), ensure: () => Promise.resolve() } },
        {
          provide: CatalogFacade,
          useValue: { manifest: signal(null), ensureManifest: () => Promise.resolve() },
        },
        { provide: SearchFacade, useValue: { query: signal(''), setQuery: jest.fn() } },
        { provide: PwaMetaService, useValue: { init: jest.fn() } },
        // jsdom lacks Element.scrollTo, used by the browser-only scroll reset.
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
      deferBlockBehavior: DeferBlockBehavior.Manual,
    }).overrideComponent(ShellComponent, {
      remove: { imports: [TopbarComponent, LogoComponent, ScrollToTopComponent] },
      add: { imports: [StubTopbarComponent, StubLogoComponent, StubScrollToTopComponent] },
    });

    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const [topbarDefer] = await fixture.getDeferBlocks();
    await topbarDefer.render(DeferBlockState.Complete);

    const renderedCrumbs = (): string[] =>
      Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('.crumb'),
        (el) => el.textContent?.trim() ?? ''
      );

    await router.navigateByUrl('/alpha');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(renderedCrumbs()).toEqual(['Alpha']);

    await router.navigateByUrl('/beta');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(renderedCrumbs()).toEqual(['Beta']);
  });
});
