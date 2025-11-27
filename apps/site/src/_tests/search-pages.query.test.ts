import { SearchPagesHandler } from '@core-application';
import { Manifest, Slug } from '@core-domain';

const manifest: Manifest = {
  sessionId: 's',
  createdAt: '',
  lastUpdatedAt: '',
  pages: [
    { id: '1', route: '/a', title: 'Alpha', tags: ['one'], relativePath: 'a.md', slug: Slug.from('a') },
    { id: '2', route: '/b', title: 'Beta', tags: ['two'], relativePath: 'b.md', slug: Slug.from('b') },
  ],
};

describe('SearchPagesHandler', () => {
  it('returns all pages when query empty', async () => {
    const q = new SearchPagesHandler();
    const res = await q.handle({ manifest, query: '   ' });
    expect(res).toHaveLength(2);
  });

  it('filters by title or tag', async () => {
    const q = new SearchPagesHandler();
    const byTitle = await q.handle({ manifest, query: 'beta' });
    expect(byTitle).toHaveLength(1);
    const byTag = await q.handle({ manifest, query: 'one' });
    expect(byTag[0].id).toBe('1');
  });
});
