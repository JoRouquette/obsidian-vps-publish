import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, convertToParamMap } from '@angular/router';
import type { Manifest } from '@core-domain';
import { Slug } from '@core-domain';

import { CatalogFacade } from '../application/facades/catalog-facade';
import { seoResolver } from '../application/resolvers/seo.resolver';
import { SeoService } from '../application/services/seo.service';

describe('seoResolver', () => {
  let catalogFacade: jest.Mocked<CatalogFacade>;
  let seoService: jest.Mocked<SeoService>;

  const mockManifest: Manifest = {
    pages: [
      {
        id: '1',
        title: 'Home',
        route: '/',
        slug: Slug.from('home'),
        relativePath: 'home.md',
        tags: [],
        description: 'Home page',
        publishedAt: new Date('2026-01-10'),
      },
      {
        id: '2',
        title: 'About',
        route: '/about',
        slug: Slug.from('about'),
        relativePath: 'about.md',
        tags: ['info'],
        description: 'About page',
        publishedAt: new Date('2026-01-11'),
      },
    ],
    lastUpdatedAt: new Date(),
    rootIndexTitle: 'Home',
  };

  beforeEach(() => {
    catalogFacade = {
      ensureManifest: jest.fn(),
      manifest: jest.fn(),
    } as unknown as jest.Mocked<CatalogFacade>;

    seoService = {
      updateFromPage: jest.fn(),
    } as unknown as jest.Mocked<SeoService>;

    TestBed.configureTestingModule({
      providers: [
        { provide: CatalogFacade, useValue: catalogFacade },
        { provide: SeoService, useValue: seoService },
      ],
    });
  });

  it('should update SEO for home route', async () => {
    catalogFacade.manifest.mockReturnValue(mockManifest);

    const route: Partial<ActivatedRouteSnapshot> = {
      url: [],
      paramMap: convertToParamMap({}),
    };

    await TestBed.runInInjectionContext(() =>
      seoResolver(route as ActivatedRouteSnapshot, {} as any)
    );

    expect(catalogFacade.ensureManifest).toHaveBeenCalled();
    expect(seoService.updateFromPage).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Home',
        route: '/',
      })
    );
  });

  it('should update SEO for /about route', async () => {
    catalogFacade.manifest.mockReturnValue(mockManifest);

    const route: Partial<ActivatedRouteSnapshot> = {
      url: [{ path: 'about', parameters: {} }],
      paramMap: convertToParamMap({}),
    };

    await TestBed.runInInjectionContext(() =>
      seoResolver(route as ActivatedRouteSnapshot, {} as any)
    );

    expect(seoService.updateFromPage).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'About',
        route: '/about',
      })
    );
  });

  it('should set default metadata when manifest is not available', async () => {
    catalogFacade.manifest.mockReturnValue(null);

    const route: Partial<ActivatedRouteSnapshot> = {
      url: [{ path: 'unknown', parameters: {} }],
      paramMap: convertToParamMap({}),
    };

    await TestBed.runInInjectionContext(() =>
      seoResolver(route as ActivatedRouteSnapshot, {} as any)
    );

    expect(seoService.updateFromPage).toHaveBeenCalledWith(null);
  });

  it('should set default metadata when page is not found', async () => {
    catalogFacade.manifest.mockReturnValue(mockManifest);

    const route: Partial<ActivatedRouteSnapshot> = {
      url: [{ path: 'non-existent', parameters: {} }],
      paramMap: convertToParamMap({}),
    };

    await TestBed.runInInjectionContext(() =>
      seoResolver(route as ActivatedRouteSnapshot, {} as any)
    );

    expect(seoService.updateFromPage).toHaveBeenCalledWith(null);
  });

  it('should handle errors gracefully and set default metadata', async () => {
    catalogFacade.ensureManifest.mockRejectedValue(new Error('Network error'));

    const route: Partial<ActivatedRouteSnapshot> = {
      url: [],
      paramMap: convertToParamMap({}),
    };

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    await TestBed.runInInjectionContext(() =>
      seoResolver(route as ActivatedRouteSnapshot, {} as any)
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[seoResolver] Failed to load page metadata'),
      expect.any(Error)
    );
    expect(seoService.updateFromPage).toHaveBeenCalledWith(null);

    consoleSpy.mockRestore();
  });

  it('should not block route navigation', async () => {
    catalogFacade.manifest.mockReturnValue(mockManifest);

    const route: Partial<ActivatedRouteSnapshot> = {
      url: [],
      paramMap: convertToParamMap({}),
    };

    const result = await TestBed.runInInjectionContext(() =>
      seoResolver(route as ActivatedRouteSnapshot, {} as any)
    );

    // Resolver should return void (non-blocking)
    expect(result).toBeUndefined();
  });
});
