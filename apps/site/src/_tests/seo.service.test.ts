import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import type { ManifestPage } from '@core-domain';
import { Slug } from '@core-domain';

import { ConfigFacade } from '../application/facades/config-facade';
import { SeoService } from '../application/services/seo.service';

describe('SeoService', () => {
  let service: SeoService;
  let titleService: Title;
  let metaService: Meta;

  beforeEach(() => {
    const configFacadeMock = {
      config: jest.fn().mockReturnValue({
        baseUrl: 'https://example.com',
        siteName: 'Test Site',
        repoUrl: '',
        reportIssuesUrl: '',
        homeWelcomeTitle: 'Welcome',
      }),
    };

    TestBed.configureTestingModule({
      providers: [SeoService, { provide: ConfigFacade, useValue: configFacadeMock }, Title, Meta],
    });

    service = TestBed.inject(SeoService);
    titleService = TestBed.inject(Title);
    metaService = TestBed.inject(Meta);
  });

  afterEach(() => {
    // Cleanup meta tags after each test
    metaService.removeTag('name="description"');
    metaService.removeTag('property="og:title"');
    metaService.removeTag('property="og:description"');
    metaService.removeTag('property="og:url"');
    metaService.removeTag('property="og:type"');
    metaService.removeTag('property="og:image"');
    metaService.removeTag('property="article:published_time"');
    metaService.removeTag('property="article:modified_time"');
    metaService.removeTag('property="article:author"');
    metaService.removeTag('name="twitter:card"');
    metaService.removeTag('name="twitter:title"');
    metaService.removeTag('name="twitter:description"');
    metaService.removeTag('name="twitter:image"');
    metaService.removeTag('name="robots"');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('updateFromPage', () => {
    it('should set default metadata when page is null', () => {
      service.updateFromPage(null);

      expect(titleService.getTitle()).toContain('Accueil');
      expect(metaService.getTag('name="description"')?.content).toContain('Bienvenue');
    });

    it('should update title from page', () => {
      const page: ManifestPage = {
        id: '1',
        title: 'Test Page',
        route: '/test',
        slug: Slug.from('test'),
        relativePath: 'test.md',
        tags: [],
        description: 'Test description',
        publishedAt: new Date('2026-01-10'),
      };

      service.updateFromPage(page);

      expect(titleService.getTitle()).toBe('Test Page | Test Site');
    });

    it('should update description from page', () => {
      const page: ManifestPage = {
        id: '1',
        title: 'Test Page',
        route: '/test',
        slug: Slug.from('test'),
        relativePath: 'test.md',
        tags: [],
        description: 'Custom description',
        publishedAt: new Date('2026-01-10'),
      };

      service.updateFromPage(page);

      const descMeta = metaService.getTag('name="description"');
      expect(descMeta?.content).toBe('Custom description');
    });

    it('should generate description from title and tags if not provided', () => {
      const page: ManifestPage = {
        id: '1',
        title: 'Test Page',
        route: '/test',
        slug: Slug.from('test'),
        relativePath: 'test.md',
        tags: ['angular', 'seo'],
        publishedAt: new Date('2026-01-10'),
      };

      service.updateFromPage(page);

      const descMeta = metaService.getTag('name="description"');
      expect(descMeta?.content).toContain('Test Page');
      expect(descMeta?.content).toContain('angular');
      expect(descMeta?.content).toContain('seo');
    });

    it('should set Open Graph meta tags', () => {
      const page: ManifestPage = {
        id: '1',
        title: 'OG Test',
        route: '/og-test',
        slug: Slug.from('og-test'),
        relativePath: 'og-test.md',
        tags: [],
        description: 'OG description',
        publishedAt: new Date('2026-01-10'),
      };

      service.updateFromPage(page);

      expect(metaService.getTag('property="og:title"')?.content).toBe('OG Test');
      expect(metaService.getTag('property="og:description"')?.content).toBe('OG description');
      expect(metaService.getTag('property="og:url"')?.content).toBe('https://example.com/og-test');
      expect(metaService.getTag('property="og:type"')?.content).toBe('article');
      expect(metaService.getTag('property="og:site_name"')?.content).toBe('Test Site');
    });

    it('should set Twitter Card meta tags', () => {
      const page: ManifestPage = {
        id: '1',
        title: 'Twitter Test',
        route: '/twitter-test',
        slug: Slug.from('twitter-test'),
        relativePath: 'twitter-test.md',
        tags: [],
        description: 'Twitter description',
        publishedAt: new Date('2026-01-10'),
      };

      service.updateFromPage(page);

      expect(metaService.getTag('name="twitter:card"')?.content).toBe('summary_large_image');
      expect(metaService.getTag('name="twitter:title"')?.content).toBe('Twitter Test');
      expect(metaService.getTag('name="twitter:description"')?.content).toBe('Twitter description');
    });

    it('should include coverImage in OG and Twitter tags', () => {
      const page: ManifestPage = {
        id: '1',
        title: 'Image Test',
        route: '/image-test',
        slug: Slug.from('image-test'),
        relativePath: 'image-test.md',
        tags: [],
        description: 'Image test',
        publishedAt: new Date('2026-01-10'),
        coverImage: '/assets/cover.jpg',
      };

      service.updateFromPage(page);

      expect(metaService.getTag('property="og:image"')?.content).toBe(
        'https://example.com/assets/cover.jpg'
      );
      expect(metaService.getTag('name="twitter:image"')?.content).toBe(
        'https://example.com/assets/cover.jpg'
      );
    });

    it('should handle absolute image URLs', () => {
      const page: ManifestPage = {
        id: '1',
        title: 'Absolute Image',
        route: '/absolute-image',
        slug: Slug.from('absolute-image'),
        relativePath: 'absolute-image.md',
        tags: [],
        publishedAt: new Date('2026-01-10'),
        coverImage: 'https://cdn.example.com/image.jpg',
      };

      service.updateFromPage(page);

      expect(metaService.getTag('property="og:image"')?.content).toBe(
        'https://cdn.example.com/image.jpg'
      );
    });

    it('should set article:published_time meta tag', () => {
      const publishDate = new Date('2026-01-10T10:30:00Z');
      const page: ManifestPage = {
        id: '1',
        title: 'Published Test',
        route: '/published',
        slug: Slug.from('published'),
        relativePath: 'published.md',
        tags: [],
        publishedAt: publishDate,
      };

      service.updateFromPage(page);

      const publishedMeta = metaService.getTag('property="article:published_time"');
      expect(publishedMeta?.content).toBe(publishDate.toISOString());
    });

    it('should set article:modified_time if lastModifiedAt provided', () => {
      const modifiedDate = new Date('2026-01-12T14:20:00Z');
      const page: ManifestPage = {
        id: '1',
        title: 'Modified Test',
        route: '/modified',
        slug: Slug.from('modified'),
        relativePath: 'modified.md',
        tags: [],
        publishedAt: new Date('2026-01-10'),
        lastModifiedAt: modifiedDate,
      };

      service.updateFromPage(page);

      const modifiedMeta = metaService.getTag('property="article:modified_time"');
      expect(modifiedMeta?.content).toBe(modifiedDate.toISOString());
    });

    it('should use canonicalSlug for canonical URL if provided', () => {
      const page: ManifestPage = {
        id: '1',
        title: 'Canonical Test',
        route: '/old-route',
        slug: Slug.from('old-route'),
        relativePath: 'canonical.md',
        tags: [],
        publishedAt: new Date('2026-01-10'),
        canonicalSlug: '/new-canonical-route',
      };

      service.updateFromPage(page);

      const ogUrl = metaService.getTag('property="og:url"');
      expect(ogUrl?.content).toBe('https://example.com/new-canonical-route');
    });

    it('should set robots noindex meta tag if noIndex is true', () => {
      const page: ManifestPage = {
        id: '1',
        title: 'No Index',
        route: '/no-index',
        slug: Slug.from('no-index'),
        relativePath: 'no-index.md',
        tags: [],
        publishedAt: new Date('2026-01-10'),
        noIndex: true,
      };

      service.updateFromPage(page);

      const robotsMeta = metaService.getTag('name="robots"');
      expect(robotsMeta?.content).toBe('noindex, nofollow');
    });

    it('should remove robots meta tag if noIndex is false', () => {
      // First set noIndex
      const noIndexPage: ManifestPage = {
        id: '1',
        title: 'No Index',
        route: '/no-index',
        slug: Slug.from('no-index'),
        relativePath: 'no-index.md',
        tags: [],
        publishedAt: new Date('2026-01-10'),
        noIndex: true,
      };

      service.updateFromPage(noIndexPage);
      expect(metaService.getTag('name="robots"')).toBeTruthy();

      // Then update with indexable page
      const indexablePage: ManifestPage = {
        ...noIndexPage,
        noIndex: false,
      };

      service.updateFromPage(indexablePage);
      expect(metaService.getTag('name="robots"')).toBeFalsy();
    });
  });
});
