import { ManifestPage } from '../../entities/manifest-page';
import { Manifest } from '../../entities/manifest';
import { Slug } from '../../value-objects/slug.value-object';

describe('Manifest Entity', () => {
  const now = new Date();
  const page: ManifestPage = {
    id: 'page1',
    title: 'Test Page',
    slug: Slug.from('test-page'),
    route: '/test-page',
    description: 'A test page',
    publishedAt: now,
    vaultPath: '/vault/page1',
    relativePath: 'pages/page1.md',
    tags: ['test', 'page'],
  };

  const manifest: Manifest = {
    sessionId: 'session123',
    createdAt: now,
    lastUpdatedAt: now,
    pages: [page],
  };

  it('should create a ManifestPage with required fields', () => {
    const minimalPage: ManifestPage = {
      id: 'page2',
      title: 'Minimal Page',
      slug: Slug.from('minimal-page'),
      route: '/minimal-page',
      publishedAt: now,
    };
    expect(minimalPage.id).toBe('page2');
    expect(minimalPage.title).toBe('Minimal Page');
    expect(minimalPage.slug.toString()).toBe('minimal-page');
    expect(minimalPage.route).toBe('/minimal-page');
    expect(minimalPage.publishedAt).toBe(now);
    expect(minimalPage.description).toBeUndefined();
    expect(minimalPage.vaultPath).toBeUndefined();
    expect(minimalPage.relativePath).toBeUndefined();
    expect(minimalPage.tags).toBeUndefined();
  });

  it('should create a Manifest with required fields and pages', () => {
    expect(manifest.sessionId).toBe('session123');
    expect(manifest.createdAt).toBe(now);
    expect(manifest.lastUpdatedAt).toBe(now);
    expect(Array.isArray(manifest.pages)).toBe(true);
    expect(manifest.pages.length).toBe(1);
    expect(manifest.pages[0]).toEqual(page);
  });

  it('should allow optional fields in ManifestPage', () => {
    expect(page.description).toBe('A test page');
    expect(page.vaultPath).toBe('/vault/page1');
    expect(page.relativePath).toBe('pages/page1.md');
    expect(page.tags).toEqual(['test', 'page']);
  });

  it('should allow ManifestPage without optional fields', () => {
    const pageNoOptional: ManifestPage = {
      id: 'page3',
      title: 'No Optional',
      slug: Slug.from('no-optional'),
      route: '/no-optional',
      publishedAt: now,
    };
    expect(pageNoOptional.description).toBeUndefined();
    expect(pageNoOptional.vaultPath).toBeUndefined();
    expect(pageNoOptional.relativePath).toBeUndefined();
    expect(pageNoOptional.tags).toBeUndefined();
  });
});
