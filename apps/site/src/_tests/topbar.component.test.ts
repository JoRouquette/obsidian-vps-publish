import { TopbarComponent } from '../presentation/pages/topbar/topbar.component';

describe('TopbarComponent mobile breadcrumbs', () => {
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

  it('keeps root context, parent back-link and current page for deep mobile breadcrumb paths', () => {
    const component = createComponent([]);
    component.crumbs = [
      { label: 'Docs', url: '/docs' },
      { label: 'Frontend', url: '/docs/frontend' },
      { label: 'Responsive', url: '/docs/frontend/responsive' },
      { label: 'Leaflet mobile', url: '/docs/frontend/responsive/leaflet-mobile' },
    ];

    expect(component.mobileContextCrumb()).toEqual({ label: 'Docs', url: '/docs' });
    expect(component.hiddenMobileCrumbCount()).toBe(1);
    expect(component.mobileBackCrumb()).toEqual({
      label: 'Responsive',
      url: '/docs/frontend/responsive',
    });
    expect(component.mobileCurrentCrumb()).toEqual({
      label: 'Leaflet mobile',
      url: '/docs/frontend/responsive/leaflet-mobile',
    });
  });

  it('keeps a simple back + current pattern when the hierarchy is short', () => {
    const component = createComponent([]);
    component.crumbs = [
      { label: 'Guides', url: '/guides' },
      { label: 'Viewer', url: '/guides/viewer' },
    ];

    expect(component.mobileContextCrumb()).toBeNull();
    expect(component.hiddenMobileCrumbCount()).toBe(0);
    expect(component.mobileBackCrumb()).toEqual({ label: 'Guides', url: '/guides' });
    expect(component.mobileCurrentCrumb()).toEqual({ label: 'Viewer', url: '/guides/viewer' });
  });
});
