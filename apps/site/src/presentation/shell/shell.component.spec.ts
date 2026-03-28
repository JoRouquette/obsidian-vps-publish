import type { Manifest } from '@core-domain';
import { Slug } from '@core-domain';

import { ShellComponent } from './shell.component';

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
