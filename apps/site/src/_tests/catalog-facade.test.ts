import { CatalogFacade } from '../application/facades/catalog-facade';
import { ContentRepository } from '../domain/ports/content-repository.port';
import { Manifest, ManifestRepository, Slug } from '@core-domain';

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

  beforeEach(() => {
    manifestRepo = { load: jest.fn().mockResolvedValue(manifest) };
    contentRepo = { fetch: jest.fn().mockResolvedValue('<p>html</p>') };
  });

  it('loads manifest on init and caches', async () => {
    const facade = new CatalogFacade(manifestRepo, contentRepo);
    await Promise.resolve();
    expect(manifestRepo.load).toHaveBeenCalledTimes(1);

    await facade.ensureManifest();
    expect(manifestRepo.load).toHaveBeenCalledTimes(2); // re-fetched on ensure
  });

  it('searches and fetches html by slug', async () => {
    const facade = new CatalogFacade(manifestRepo, contentRepo);
    await Promise.resolve();

    facade.query.set('start');
    const res = await facade.results();
    expect(res).toHaveLength(1);

    const html = await facade.getHtmlBySlugOrRoute('start');
    expect(html?.html).toContain('html');
    expect(contentRepo.fetch).toHaveBeenCalledWith('/docs/start');
  });
});
