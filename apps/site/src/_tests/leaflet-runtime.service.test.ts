import { TestBed } from '@angular/core/testing';
import { defaultManifest, Slug, type Manifest } from '@core-domain';

import { CatalogFacade } from '../application/facades/catalog-facade';
import { LeafletRuntimeService } from '../application/services/leaflet-runtime.service';
import { ContentVersionService } from '../infrastructure/content-version/content-version.service';

describe('LeafletRuntimeService', () => {
  const manifest: Manifest = {
    ...defaultManifest,
    pages: [
      {
        id: 'page-1',
        title: 'Ektaron',
        slug: Slug.from('ektaron'),
        route: '/worlds/ektaron',
        publishedAt: new Date('2026-03-22T00:00:00.000Z'),
      },
      {
        id: 'page-2',
        title: 'Luminara (V)',
        aliases: ['Luminara'],
        slug: Slug.from('luminara-v'),
        route: '/anorin-sirdalea/amel-fass/luminara-v',
        publishedAt: new Date('2026-03-22T00:00:00.000Z'),
      },
    ],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        LeafletRuntimeService,
        {
          provide: CatalogFacade,
          useValue: {
            manifest: () => manifest,
          },
        },
        {
          provide: ContentVersionService,
          useValue: {
            currentVersion: 'cv-123',
          },
        },
      ],
    });
  });

  it('resolves internal note links to published routes from the manifest', () => {
    const service = TestBed.inject(LeafletRuntimeService);

    expect(service.resolveMarkerLink('Ektaron')).toEqual({
      href: '/worlds/ektaron',
      external: false,
      text: 'Ektaron',
    });
  });

  it('keeps external marker links external', () => {
    const service = TestBed.inject(LeafletRuntimeService);

    expect(service.resolveMarkerLink('https://example.com/map')).toEqual({
      href: 'https://example.com/map',
      external: true,
      text: 'https://example.com/map',
    });
  });

  it('builds overlay asset URLs with content-version cache busting', () => {
    const service = TestBed.inject(LeafletRuntimeService);

    expect(service.buildOverlayAssetUrl('maps/Ektaron.png')).toBe(
      '/assets/maps/Ektaron.png?cv=cv-123'
    );
  });

  it('resolves alias-based marker links using the same canonical resolver as Node', () => {
    const service = TestBed.inject(LeafletRuntimeService);

    expect(service.resolveMarkerLink('Luminara')).toEqual({
      href: '/anorin-sirdalea/amel-fass/luminara-v',
      external: false,
      text: 'Luminara (V)',
    });
  });

  it('keeps unresolved marker links unresolved instead of guessing a route', () => {
    const service = TestBed.inject(LeafletRuntimeService);

    expect(service.resolveMarkerLink('Unknown Note')).toEqual({
      href: '',
      external: false,
      text: 'Unknown Note',
      unresolved: true,
      unresolvedReason: 'not-found',
    });
  });

  it('stores and returns persisted view state by map identity', () => {
    const service = TestBed.inject(LeafletRuntimeService);

    service.persistViewState('ektaron-map', {
      center: [12, 34],
      zoom: 6,
      simpleCrs: true,
    });

    expect(service.getPersistedViewState('ektaron-map', { simpleCrs: true })).toEqual({
      center: [12, 34],
      zoom: 6,
      simpleCrs: true,
    });
    expect(service.getPersistedViewState('ektaron-map', { simpleCrs: false })).toBeNull();
  });
});
