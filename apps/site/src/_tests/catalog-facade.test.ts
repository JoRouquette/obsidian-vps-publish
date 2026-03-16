import { type Manifest, type ManifestRepository, Slug } from '@core-domain';
import { Subject } from 'rxjs';

import { CatalogFacade } from '../application/facades/catalog-facade';
import type { ContentRepository } from '../domain/ports/content-repository.port';

describe('CatalogFacade', () => {
  const page = {
    id: '1',
    route: '/docs/start',
    title: 'Start',
    tags: ['guide'],
    relativePath: 'docs/start.md',
    slug: Slug.from('start'),
    publishedAt: new Date(),
  };

  const manifest: Manifest = {
    sessionId: 's1',
    createdAt: new Date(),
    lastUpdatedAt: new Date(),
    pages: [page],
  };

  let manifestRepo: jest.Mocked<ManifestRepository>;
  let contentRepo: jest.Mocked<ContentRepository>;
  let versionChanged$: Subject<{ version: string; generatedAt: string }>;
  let contentVersionService: {
    versionChanged$: Subject<{ version: string; generatedAt: string }>;
    checkVersion: jest.Mock<Promise<null>, []>;
  };

  beforeEach(() => {
    manifestRepo = { load: jest.fn().mockResolvedValue(manifest) };
    contentRepo = { fetch: jest.fn().mockResolvedValue('<p>html</p>') };
    versionChanged$ = new Subject<{ version: string; generatedAt: string }>();
    contentVersionService = {
      versionChanged$,
      checkVersion: jest.fn().mockResolvedValue(null),
    };
  });

  it('loads manifest on init and caches', async () => {
    const facade = new CatalogFacade(manifestRepo, contentRepo, contentVersionService);
    await Promise.resolve();
    await Promise.resolve();
    expect(contentVersionService.checkVersion).toHaveBeenCalledTimes(1);
    expect(manifestRepo.load).toHaveBeenCalledTimes(1);

    await facade.ensureManifest();
    expect(manifestRepo.load).toHaveBeenCalledTimes(2); // re-fetched on ensure
  });

  it('searches and fetches html by slug', async () => {
    const facade = new CatalogFacade(manifestRepo, contentRepo, contentVersionService);
    await Promise.resolve();
    await Promise.resolve();

    facade.query.set('start');
    const res = await facade.results();
    expect(res).toHaveLength(1);

    const html = await facade.getHtmlBySlugOrRoute('start');
    expect(html?.html).toContain('html');
    expect(contentRepo.fetch).toHaveBeenCalledWith('/docs/start');
  });

  it('reloads the manifest when content version changes', async () => {
    const updatedManifest: Manifest = {
      ...manifest,
      pages: [
        {
          ...page,
          route: '/ektaron',
          title: 'Ektaron',
          leafletBlocks: [
            {
              id: 'Ektaron-map',
              imageOverlays: [{ path: 'Ektaron.webp' }],
            },
          ],
        },
      ],
    };

    manifestRepo.load.mockResolvedValueOnce(manifest).mockResolvedValueOnce(updatedManifest);

    const facade = new CatalogFacade(manifestRepo, contentRepo, contentVersionService);
    await Promise.resolve();
    await Promise.resolve();

    versionChanged$.next({
      version: 'new-version',
      generatedAt: new Date().toISOString(),
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(manifestRepo.load).toHaveBeenCalledTimes(2);
    expect(facade.manifest().pages[0]?.leafletBlocks?.[0]?.imageOverlays?.[0]?.path).toBe(
      'Ektaron.webp'
    );
  });
});
