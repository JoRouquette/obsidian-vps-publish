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

  it('uses folderDisplayNames from manifest for folder labels', async () => {
    // Manifest with folderDisplayNames dictionary
    const displayManifest: Manifest = {
      sessionId: 's',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      pages: [
        {
          id: '1',
          route: '/pantheon/thormak',
          title: 'Thormak',
          publishedAt: new Date(),
          slug: Slug.from('thormak'),
        },
        {
          id: '2',
          route: '/ektaron/anorin-sirdalea/eldalonde',
          title: 'Eldalondë',
          publishedAt: new Date(),
          slug: Slug.from('eldalonde'),
        },
        {
          id: '3',
          route: '/arali/arakishib/sceau-mineur',
          title: 'Sceau mineur',
          publishedAt: new Date(),
          slug: Slug.from('sceau-mineur'),
        },
      ],
      folderDisplayNames: {
        '/pantheon': 'Panthéon',
        '/ektaron/anorin-sirdalea': 'Anorin Sírdalëa',
        '/arali/arakishib': 'Arakišib',
      },
    };

    const q = new BuildTreeHandler();
    const tree = await q.handle(displayManifest);

    // Check that displayName is used for folders
    const pantheon = tree.children?.find((c) => c.name === 'pantheon');
    expect(pantheon?.displayName).toBe('Panthéon');
    expect(pantheon?.label).toBe('Pantheon'); // label is prettified from slug

    const ektaron = tree.children?.find((c) => c.name === 'ektaron');
    expect(ektaron).toBeDefined();

    const anorin = ektaron?.children?.find((c) => c.name === 'anorin-sirdalea');
    expect(anorin?.displayName).toBe('Anorin Sírdalëa');

    const arali = tree.children?.find((c) => c.name === 'arali');
    expect(arali).toBeDefined();

    const arakishib = arali?.children?.find((c) => c.name === 'arakishib');
    expect(arakishib?.displayName).toBe('Arakišib');

    // Verify that folders without displayName still have label
    expect(ektaron?.displayName).toBeUndefined();
    expect(ektaron?.label).toBe('Ektaron');

    expect(arali?.displayName).toBeUndefined();
    expect(arali?.label).toBe('Arali');
  });
});
