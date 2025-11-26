import { SearchPagesQuery } from '../application/queries/search-pages.query';
import { Manifest } from '../domain/models/manifest';
import { Slug } from '../domain/value-objects/slug.value-object';

const manifest: Manifest = {
  sessionId: 's',
  createdAt: '',
  lastUpdatedAt: '',
  pages: [
    { id: '1', route: '/a', title: 'Alpha', tags: ['one'], relativePath: 'a.md', slug: Slug.from('a') },
    { id: '2', route: '/b', title: 'Beta', tags: ['two'], relativePath: 'b.md', slug: Slug.from('b') },
  ],
};

describe('SearchPagesQuery', () => {
  it('returns all pages when query empty', async () => {
    const q = new SearchPagesQuery();
    const res = await q.execute({ manifest, query: '   ' });
    expect(res).toHaveLength(2);
  });

  it('filters by title or tag', async () => {
    const q = new SearchPagesQuery();
    const byTitle = await q.execute({ manifest, query: 'beta' });
    expect(byTitle).toHaveLength(1);
    const byTag = await q.execute({ manifest, query: 'one' });
    expect(byTag[0].id).toBe('1');
  });
});
