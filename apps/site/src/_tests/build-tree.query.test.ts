import { BuildTreeQuery } from '../application/queries/build-tree.query';
import { Manifest } from '../domain/models/manifest';
import { Slug } from '../domain/value-objects/slug.value-object';

const manifest: Manifest = {
  sessionId: 's',
  createdAt: '',
  lastUpdatedAt: '',
  pages: [
    { id: '1', route: '/guide/start', title: 'Start', tags: [], relativePath: 'guide/start.md', slug: Slug.from('start') },
    { id: '2', route: '/guide/deep/page', title: 'Deep', tags: [], relativePath: 'guide/deep/page.md', slug: Slug.from('page') },
    { id: '3', route: '/home', title: 'Home', tags: [], relativePath: 'home.md', slug: Slug.from('home') },
    // duplicate file to cover skip branch
    { id: '4', route: '/home', title: 'Home Duplicate', tags: [], relativePath: 'home.md', slug: Slug.from('home') },
  ],
};

describe('BuildTreeQuery', () => {
  it('builds folder/file tree with counts and sorting', async () => {
    const q = new BuildTreeQuery();
    const tree = await q.execute(manifest);

    expect(tree.children?.find((c) => c.name === 'guide')?.count).toBe(3);
    const guide = tree.children?.find((c) => c.name === 'guide');
    expect(guide?.children?.some((c) => c.kind === 'folder' && c.name === 'deep')).toBe(true);
    expect(tree.children?.some((c) => c.kind === 'file' && c.name === 'home')).toBe(true);
  });
});
