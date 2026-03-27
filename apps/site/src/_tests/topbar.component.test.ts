import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { TopbarComponent } from '../presentation/pages/topbar/topbar.component';

describe('TopbarComponent mobile breadcrumbs', () => {
  const repoRoot = process.cwd();

  function createComponent(crumbs: Array<{ label: string; url: string }>) {
    return new TopbarComponent(
      {
        url: '/',
        navigateByUrl: jest.fn(),
        navigate: jest.fn(),
      } as any,
      {
        query: () => '',
        setQuery: jest.fn(),
        ensureIndex: jest.fn(),
      } as any
    );
  }

  it('keeps all ancestor links navigable for deep mobile breadcrumb paths', () => {
    const component = createComponent([]);
    component.crumbs = [
      { label: 'Docs', url: '/docs' },
      { label: 'Frontend', url: '/docs/frontend' },
      { label: 'Responsive', url: '/docs/frontend/responsive' },
      { label: 'Leaflet mobile', url: '/docs/frontend/responsive/leaflet-mobile' },
    ];

    expect(component.mobileAncestorCrumbs()).toEqual([
      { label: 'Docs', url: '/docs' },
      { label: 'Frontend', url: '/docs/frontend' },
      { label: 'Responsive', url: '/docs/frontend/responsive' },
    ]);
    expect(component.mobileCurrentCrumb()).toEqual({
      label: 'Leaflet mobile',
      url: '/docs/frontend/responsive/leaflet-mobile',
    });
  });

  it('keeps the direct ancestor trail for short hierarchies', () => {
    const component = createComponent([]);
    component.crumbs = [
      { label: 'Guides', url: '/guides' },
      { label: 'Viewer', url: '/guides/viewer' },
    ];

    expect(component.mobileAncestorCrumbs()).toEqual([{ label: 'Guides', url: '/guides' }]);
    expect(component.mobileCurrentCrumb()).toEqual({ label: 'Viewer', url: '/guides/viewer' });
  });

  it('keeps a navigable home ancestor for single-level pages and folder indexes', () => {
    const component = createComponent([]);
    component.crumbs = [{ label: 'Guides', url: '/guides/index' }];

    expect(component.mobileAncestorCrumbs()).toEqual([{ label: 'Accueil', url: '/' }]);
    expect(component.mobileCurrentCrumb()).toEqual({ label: 'Guides', url: '/guides/index' });
  });

  it('keeps all nested folder index ancestors navigable', () => {
    const component = createComponent([]);
    component.crumbs = [
      { label: 'Docs', url: '/docs/index' },
      { label: 'Frontend', url: '/docs/frontend/index' },
      { label: 'Responsive', url: '/docs/frontend/responsive/index' },
    ];

    expect(component.mobileAncestorCrumbs()).toEqual([
      { label: 'Docs', url: '/docs/index' },
      { label: 'Frontend', url: '/docs/frontend/index' },
    ]);
    expect(component.mobileCurrentCrumb()).toEqual({
      label: 'Responsive',
      url: '/docs/frontend/responsive/index',
    });
  });

  it('keeps the mobile breadcrumb template focused on ancestor navigation and current page', () => {
    const template = readFileSync(
      join(repoRoot, 'apps/site/src/presentation/pages/topbar/topbar.component.html'),
      'utf8'
    );

    expect(template).toContain('data-testid="breadcrumbs-mobile"');
    expect(template).toContain('class="breadcrumbs-mobile-path"');
    expect(template).toContain('class="ancestor-link"');
    expect(template).toContain('class="current" aria-current="page"');
    expect(template).not.toContain('overflow-x: auto');
  });
});
