import type { ManifestPage } from '../../entities/manifest-page';
import type { Manifest } from '../../entities/manifest';

describe('ManifestPage - SEO Fields', () => {
  it('should accept optional SEO fields', () => {
    const page: ManifestPage = {
      id: 'test-id',
      title: 'Test Page',
      slug: 'test-page' as any,
      route: '/test-page',
      publishedAt: new Date('2026-01-01'),
      // SEO fields
      lastModifiedAt: new Date('2026-01-12'),
      coverImage: '/assets/cover.png',
      canonicalSlug: 'test-page',
      noIndex: false,
    };

    expect(page.lastModifiedAt).toBeInstanceOf(Date);
    expect(page.coverImage).toBe('/assets/cover.png');
    expect(page.canonicalSlug).toBe('test-page');
    expect(page.noIndex).toBe(false);
  });

  it('should allow SEO fields to be undefined', () => {
    const page: ManifestPage = {
      id: 'test-id',
      title: 'Test Page',
      slug: 'test-page' as any,
      route: '/test-page',
      publishedAt: new Date('2026-01-01'),
    };

    expect(page.lastModifiedAt).toBeUndefined();
    expect(page.coverImage).toBeUndefined();
    expect(page.canonicalSlug).toBeUndefined();
    expect(page.noIndex).toBeUndefined();
  });

  it('should handle noIndex flag for excluding pages from sitemap', () => {
    const draftPage: ManifestPage = {
      id: 'draft-id',
      title: 'Draft Page',
      slug: 'draft-page' as any,
      route: '/drafts/draft-page',
      publishedAt: new Date('2026-01-01'),
      noIndex: true, // Exclude from sitemap
    };

    expect(draftPage.noIndex).toBe(true);
  });

  it('should store canonicalSlug for redirect management', () => {
    const renamedPage: ManifestPage = {
      id: 'page-id',
      title: 'New Title',
      slug: 'new-title' as any,
      route: '/new-title',
      publishedAt: new Date('2026-01-01'),
      canonicalSlug: 'new-title', // Original slug for canonical URL
    };

    expect(renamedPage.canonicalSlug).toBe('new-title');
  });
});

describe('Manifest - SEO Fields', () => {
  it('should accept optional canonicalMap for redirects', () => {
    const manifest: Manifest = {
      sessionId: 'session-1',
      createdAt: new Date('2026-01-01'),
      lastUpdatedAt: new Date('2026-01-12'),
      pages: [],
      canonicalMap: {
        '/old-route': '/new-route',
        '/legacy-page': '/current-page',
      },
    };

    expect(manifest.canonicalMap).toBeDefined();
    expect(manifest.canonicalMap!['/old-route']).toBe('/new-route');
    expect(manifest.canonicalMap!['/legacy-page']).toBe('/current-page');
  });

  it('should allow canonicalMap to be undefined', () => {
    const manifest: Manifest = {
      sessionId: 'session-1',
      createdAt: new Date('2026-01-01'),
      lastUpdatedAt: new Date('2026-01-12'),
      pages: [],
    };

    expect(manifest.canonicalMap).toBeUndefined();
  });

  it('should handle slug history via canonicalMap', () => {
    const manifest: Manifest = {
      sessionId: 'session-1',
      createdAt: new Date('2026-01-01'),
      lastUpdatedAt: new Date('2026-01-12'),
      pages: [
        {
          id: 'page-1',
          title: 'Updated Title',
          slug: 'updated-title' as any,
          route: '/updated-title',
          publishedAt: new Date('2026-01-01'),
          canonicalSlug: 'updated-title',
        },
      ],
      canonicalMap: {
        '/old-title': '/updated-title', // Old route redirects to new
      },
    };

    // Verify redirect mapping exists
    expect(manifest.canonicalMap!['/old-title']).toBe('/updated-title');

    // Verify page has new route
    const page = manifest.pages[0];
    expect(page.route).toBe('/updated-title');
  });

  it('should preserve existing folderDisplayNames alongside canonicalMap', () => {
    const manifest: Manifest = {
      sessionId: 'session-1',
      createdAt: new Date('2026-01-01'),
      lastUpdatedAt: new Date('2026-01-12'),
      pages: [],
      folderDisplayNames: {
        '/tresors': 'Trésors',
      },
      canonicalMap: {
        '/old-route': '/new-route',
      },
    };

    expect(manifest.folderDisplayNames).toBeDefined();
    expect(manifest.canonicalMap).toBeDefined();
    expect(manifest.folderDisplayNames!['/tresors']).toBe('Trésors');
    expect(manifest.canonicalMap!['/old-route']).toBe('/new-route');
  });
});
