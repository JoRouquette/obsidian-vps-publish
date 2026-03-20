import { provideLocationMocks } from '@angular/common/testing';
import { Component, PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { defaultManifest, type Manifest } from '@core-domain';
import type { LeafletBlock } from '@core-domain/entities/leaflet-block';

import { CatalogFacade } from '../application/facades/catalog-facade';
import { CONTENT_REPOSITORY } from '../domain/ports/tokens';
import { OfflineDetectionService, VisitedPagesService } from '../infrastructure/offline';
import { AnchorScrollService } from '../presentation/services/anchor-scroll.service';
import { LeafletInjectionService } from '../presentation/services/leaflet-injection.service';
import { ViewerComponent } from '../presentation/pages/viewer/viewer.component';

jest.mock('../application/facades/catalog-facade', () => ({
  CatalogFacade: class MockCatalogFacade {},
}));

@Component({ standalone: true, template: '' })
class DummyRouteComponent {}

const mathPageHtml = `
  <div class="markdown-body">
    <p>Avant</p>
    <span class="katex-display">
      <span class="katex">
        <span class="katex-html" aria-hidden="true">
          <span class="base">
            <span class="mord text"><span class="mord textrm">DD psionique</span></span>
          </span>
        </span>
      </span>
    </span>
    <p>Apres</p>
  </div>
`;

const secondMathPageHtml = `
  <div class="markdown-body">
    <p>Equation</p>
    <span class="katex"><span class="katex-html" aria-hidden="true">E=mc^2</span></span>
  </div>
`;

const leafletPageHtml = `
  <div class="markdown-body">
    <div data-leaflet-map-id="Ektaron-map"></div>
  </div>
`;

const unresolvedLinkPageHtml = `
  <div class="markdown-body">
    <p>
      <span
        class="wikilink wikilink-unresolved"
        role="link"
        aria-disabled="true"
        tabindex="0"
        title="Cette page sera bientot disponible"
        data-tooltip="Cette page sera bientot disponible"
        data-wikilink="Missing Page"
      >Missing Page</span>
    </p>
  </div>
`;

function createLeafletBlock(path: string): LeafletBlock {
  return {
    id: 'Ektaron-map',
    imageOverlays: [
      {
        path,
        topLeft: [0, 0],
        bottomRight: [100, 100],
      },
    ],
  };
}

function createManifest(): Manifest {
  return {
    ...defaultManifest,
    pages: [
      {
        title: 'Math Note',
        route: '/math-note',
        slug: 'math-note',
        lastUpdatedAt: '',
      },
      {
        title: 'Math Note 2',
        route: '/math-note-2',
        slug: 'math-note-2',
        lastUpdatedAt: '',
      },
      {
        title: 'Ektaron',
        route: '/ektaron',
        slug: 'ektaron',
        lastUpdatedAt: '',
        leafletBlocks: [createLeafletBlock('Ektaron.png')],
      },
    ],
  };
}

describe('ViewerComponent math HTML rendering', () => {
  const fetch = jest.fn<Promise<string>, [string]>();
  const recordVisit = jest.fn();
  let router: Router;
  let manifestSignal: ReturnType<typeof signal<Manifest>>;
  let leafletInjectionService: {
    canRun: boolean;
    findPlaceholders: jest.Mock<HTMLElement[], [HTMLElement, string]>;
    runInjectionPass: jest.Mock;
    destroyAll: jest.Mock;
  };

  async function createComponent(platformId: 'browser' | 'server' = 'browser') {
    fetch.mockImplementation(async (path: string) => {
      if (path === '/math-note.html') {
        return mathPageHtml;
      }
      if (path === '/math-note-2.html') {
        return secondMathPageHtml;
      }
      if (path === '/ektaron.html') {
        return leafletPageHtml;
      }
      if (path === '/unresolved.html') {
        return unresolvedLinkPageHtml;
      }
      return '<div class="markdown-body"><p>Index</p></div>';
    });

    manifestSignal = signal(createManifest());
    leafletInjectionService = {
      canRun: platformId === 'browser',
      findPlaceholders: jest.fn((container: HTMLElement, selector: string) =>
        Array.from(container.querySelectorAll<HTMLElement>(selector))
      ),
      runInjectionPass: jest.fn(),
      destroyAll: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ViewerComponent, DummyRouteComponent],
      providers: [
        provideRouter([
          { path: '', component: DummyRouteComponent },
          { path: 'math-note', component: DummyRouteComponent },
          { path: 'math-note-2', component: DummyRouteComponent },
          { path: 'ektaron', component: DummyRouteComponent },
          { path: 'unresolved', component: DummyRouteComponent },
        ]),
        provideLocationMocks(),
        { provide: PLATFORM_ID, useValue: platformId },
        { provide: CONTENT_REPOSITORY, useValue: { fetch } },
        { provide: CatalogFacade, useValue: { manifest: manifestSignal } },
        { provide: LeafletInjectionService, useValue: leafletInjectionService },
        { provide: VisitedPagesService, useValue: { recordVisit } },
        { provide: OfflineDetectionService, useValue: { isOffline: false } },
        {
          provide: AnchorScrollService,
          useValue: {
            navigateToAnchor: jest.fn().mockResolvedValue(undefined),
            isCurrentPageLink: jest.fn().mockReturnValue(false),
            scrollToAnchor: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(ViewerComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.resetTestingModule();
  });

  it('injects KaTeX HTML produced by the backend without client-side math rendering', async () => {
    const fixture = await createComponent();

    await router.navigateByUrl('/math-note');
    await fixture.whenStable();
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    expect(fetch).toHaveBeenCalledWith('/math-note.html');
    expect(host.querySelector('.katex-display')).toBeTruthy();
    expect(host.textContent).toContain('DD psionique');
    expect(host.textContent).toContain('Avant');
    expect(host.textContent).toContain('Apres');
  });

  it('keeps math HTML stable after route navigation and component recreation', async () => {
    const fixture = await createComponent();

    await router.navigateByUrl('/math-note');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.katex-display')).toBeTruthy();

    await router.navigateByUrl('/math-note-2');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fetch).toHaveBeenCalledWith('/math-note-2.html');
    expect(fixture.nativeElement.querySelector('.katex-display')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.katex')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('E=mc^2');

    fixture.destroy();

    TestBed.resetTestingModule();
    const recreatedFixture = await createComponent();
    await router.navigateByUrl('/math-note');
    await recreatedFixture.whenStable();
    recreatedFixture.detectChanges();

    expect(recreatedFixture.nativeElement.querySelector('.katex-display')).toBeTruthy();
    expect(recreatedFixture.nativeElement.textContent).toContain('DD psionique');
  });

  it('does not introduce an obvious SSR regression when the viewer runs on the server platform', async () => {
    const fixture = await createComponent('server');

    await router.navigateByUrl('/math-note');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fetch).toHaveBeenCalledWith('/math-note.html');
    expect(fixture.nativeElement.querySelector('.katex-display')).toBeTruthy();
  });

  it('re-injects Leaflet with updated manifest data when the current page blocks change', async () => {
    const fixture = await createComponent();

    await router.navigateByUrl('/ektaron');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fetch).toHaveBeenCalledWith('/ektaron.html');
    expect(leafletInjectionService.runInjectionPass).toHaveBeenCalled();

    manifestSignal.update((manifest) => ({
      ...manifest,
      pages: manifest.pages.map((page) =>
        page.route === '/ektaron'
          ? {
              ...page,
              leafletBlocks: [createLeafletBlock('Ektaron.webp')],
            }
          : page
      ),
    }));
    await fixture.whenStable();
    fixture.detectChanges();

    const lastCall =
      leafletInjectionService.runInjectionPass.mock.calls[
        leafletInjectionService.runInjectionPass.mock.calls.length - 1
      ]?.[0];
    const placeholder = fixture.nativeElement.querySelector('[data-leaflet-map-id="Ektaron-map"]');
    const resolution = lastCall.resolveBlock(placeholder);

    expect(leafletInjectionService.runInjectionPass.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(resolution).toEqual(
      expect.objectContaining({
        ok: true,
        mapId: 'Ektaron-map',
        block: expect.objectContaining({
          imageOverlays: [expect.objectContaining({ path: 'Ektaron.webp' })],
        }),
      })
    );
  });

  it('shows the unavailable-link state on click for unresolved wikilinks', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance as unknown as {
      showTooltip: (event: Event) => void;
    };
    const showTooltipSpy = jest.spyOn(component, 'showTooltip').mockImplementation(() => {});

    await router.navigateByUrl('/unresolved');
    await fixture.whenStable();
    fixture.detectChanges();

    const unresolvedLink = fixture.nativeElement.querySelector<HTMLElement>('.wikilink-unresolved');
    expect(unresolvedLink).toBeTruthy();

    unresolvedLink?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(showTooltipSpy).toHaveBeenCalled();
  });
});
