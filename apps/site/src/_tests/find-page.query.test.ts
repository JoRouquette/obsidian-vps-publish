import { FindPageHandler } from '@core-application';
import { Manifest, Slug } from '@core-domain';

const manifest: Manifest = {
  sessionId: 's',
  createdAt: '',
  lastUpdatedAt: '',
  pages: [
    { id: '1', route: '/a', title: 'Alpha', tags: [], relativePath: 'a.md', slug: Slug.from('a') },
    { id: '2', route: '/b', title: 'Beta', tags: [], relativePath: 'b.md', slug: Slug.from('b') },
  ],
};

describe('FindPageHandler', () => {
  it('finds by slug or route', async () => {
    const q = new FindPageHandler();
    const bySlug = await q.handle({ manifest, slugOrRoute: 'a' });
    expect(bySlug?.id).toBe('1');
    const byRoute = await q.handle({ manifest, slugOrRoute: '/b' });
    expect(byRoute?.id).toBe('2');
  });

  it('returns undefined if not found', async () => {
    const q = new FindPageHandler();
    const res = await q.handle({ manifest, slugOrRoute: 'missing' });
    expect(res).toBeUndefined();
  });
});
