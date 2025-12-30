import { BuildTreeHandler } from '@core-application';
import { type Manifest, Slug } from '@core-domain';

const manifest: Manifest = {
  sessionId: 's',
  createdAt: '',
  lastUpdatedAt: '',
  pages: [
    {
      id: '1',
      route: '/guide/start',
      title: 'Start',
      tags: [],
      relativePath: 'guide/start.md',
      slug: Slug.from('start'),
    },
    {
      id: '2',
      route: '/guide/deep/page',
      title: 'Deep',
      tags: [],
      relativePath: 'guide/deep/page.md',
      slug: Slug.from('page'),
    },
    {
      id: '3',
      route: '/home',
      title: 'Home',
      tags: [],
      relativePath: 'home.md',
      slug: Slug.from('home'),
    },
    // duplicate file to cover skip branch
    {
      id: '4',
      route: '/home',
      title: 'Home Duplicate',
      tags: [],
      relativePath: 'home.md',
      slug: Slug.from('home'),
    },
  ],
};

describe('BuildTreeHandler', () => {
  it('builds folder/file tree with counts and sorting', async () => {
    const q = new BuildTreeHandler();
    const tree = await q.handle(manifest);

    expect(tree.children?.find((c) => c.name === 'guide')?.count).toBe(3);
    const guide = tree.children?.find((c) => c.name === 'guide');
    expect(guide?.children?.some((c) => c.kind === 'folder' && c.name === 'deep')).toBe(true);
    expect(tree.children?.some((c) => c.kind === 'file' && c.name === 'home')).toBe(true);
  });

  it('handles flattened routes (flattenTree=true) correctly', async () => {
    // Simulate manifest with flattenTree routes (no intermediate folder segments)
    const flatManifest: Manifest = {
      sessionId: 's',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      pages: [
        {
          id: '1',
          route: '/le-vivant/flore/chene',
          title: 'Chêne',
          publishedAt: new Date(),
          slug: Slug.from('chene'),
        },
        {
          id: '2',
          route: '/le-vivant/flore/erable',
          title: 'Érable',
          publishedAt: new Date(),
          slug: Slug.from('erable'),
        },
        {
          id: '3',
          route: '/le-vivant/flore/rose',
          title: 'Rose',
          publishedAt: new Date(),
          slug: Slug.from('rose'),
        },
      ],
    };

    const q = new BuildTreeHandler();
    const tree = await q.handle(flatManifest);

    const leVivant = tree.children?.find((c) => c.name === 'le-vivant');
    expect(leVivant).toBeDefined();

    const flore = leVivant?.children?.find((c) => c.name === 'flore');
    expect(flore).toBeDefined();
    expect(flore?.kind).toBe('folder');

    // Flattened tree: all pages directly under 'flore', no subfolders
    const floreChildren = flore?.children ?? [];
    expect(floreChildren.length).toBe(3);
    expect(floreChildren.every((c) => c.kind === 'file')).toBe(true);

    const chene = floreChildren.find((c) => c.name === 'chene');
    expect(chene?.label).toBe('Chêne');
    expect(chene?.route).toBe('/le-vivant/flore/chene');

    const erable = floreChildren.find((c) => c.name === 'erable');
    expect(erable?.label).toBe('Érable');

    const rose = floreChildren.find((c) => c.name === 'rose');
    expect(rose?.label).toBe('Rose');
  });
});
