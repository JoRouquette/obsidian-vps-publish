import { FindPageQuery } from '../application/queries/find-page.query';
import { Manifest } from '../domain/models/manifest';
import { Slug } from '../domain/value-objects/slug.value-object';

const manifest: Manifest = {
  sessionId: 's',
  createdAt: '',
  lastUpdatedAt: '',
  pages: [
    { id: '1', route: '/a', title: 'Alpha', tags: [], relativePath: 'a.md', slug: Slug.from('a') },
    { id: '2', route: '/b', title: 'Beta', tags: [], relativePath: 'b.md', slug: Slug.from('b') },
  ],
};

describe('FindPageQuery', () => {
  it('finds by slug or route', async () => {
    const q = new FindPageQuery();
    const bySlug = await q.execute({ manifest, slugOrRoute: 'a' });
    expect(bySlug?.id).toBe('1');
    const byRoute = await q.execute({ manifest, slugOrRoute: '/b' });
    expect(byRoute?.id).toBe('2');
  });

  it('returns undefined if not found', async () => {
    const q = new FindPageQuery();
    const res = await q.execute({ manifest, slugOrRoute: 'missing' });
    expect(res).toBeUndefined();
  });
});
