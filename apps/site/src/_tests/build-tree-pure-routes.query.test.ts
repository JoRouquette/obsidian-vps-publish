import { BuildTreeHandler } from '@core-application';
import { type Manifest, Slug } from '@core-domain';

describe('BuildTreeHandler - Pure Route Nodes', () => {
  it('should handle pure route nodes (no physical folder)', async () => {
    // Simulate a route tree with a pure route node "/guides"
    // that doesn't correspond to any physical vault folder
    const manifest: Manifest = {
      sessionId: 's',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      pages: [
        {
          id: '1',
          route: '/guides/getting-started',
          title: 'Getting Started',
          publishedAt: new Date(),
          slug: Slug.from('getting-started'),
        },
        {
          id: '2',
          route: '/guides/advanced',
          title: 'Advanced Topics',
          publishedAt: new Date(),
          slug: Slug.from('advanced'),
        },
      ],
    };

    const handler = new BuildTreeHandler();
    const tree = await handler.handle(manifest);

    // Tree should be built based on routes, not physical folders
    const guidesFolder = tree.children?.find((c) => c.name === 'guides');
    expect(guidesFolder).toBeDefined();
    expect(guidesFolder?.kind).toBe('folder');
    expect(guidesFolder?.label).toBe('Guides');

    // Files should be children of the guides folder
    const files = guidesFolder?.children ?? [];
    expect(files.length).toBe(2);
    expect(files.every((c) => c.kind === 'file')).toBe(true);

    const gettingStarted = files.find((c) => c.name === 'getting-started');
    expect(gettingStarted?.label).toBe('Getting Started');
    expect(gettingStarted?.route).toBe('/guides/getting-started');

    const advanced = files.find((c) => c.name === 'advanced');
    expect(advanced?.label).toBe('Advanced Topics');
  });

  it('should handle nested pure route nodes', async () => {
    // Pure routes: /api (no folder) → /api/v1 (no folder) → files
    const manifest: Manifest = {
      sessionId: 's',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      pages: [
        {
          id: '1',
          route: '/api/v1/users',
          title: 'Users API',
          publishedAt: new Date(),
          slug: Slug.from('users'),
        },
        {
          id: '2',
          route: '/api/v1/auth',
          title: 'Auth API',
          publishedAt: new Date(),
          slug: Slug.from('auth'),
        },
        {
          id: '3',
          route: '/api/v2/resources',
          title: 'Resources API',
          publishedAt: new Date(),
          slug: Slug.from('resources'),
        },
      ],
    };

    const handler = new BuildTreeHandler();
    const tree = await handler.handle(manifest);

    // Should create hierarchy: api → v1, v2 → files
    const api = tree.children?.find((c) => c.name === 'api');
    expect(api).toBeDefined();
    expect(api?.kind).toBe('folder');

    const v1 = api?.children?.find((c) => c.name === 'v1');
    expect(v1).toBeDefined();
    expect(v1?.kind).toBe('folder');
    expect(v1?.children?.length).toBe(2);

    const v2 = api?.children?.find((c) => c.name === 'v2');
    expect(v2).toBeDefined();
    expect(v2?.children?.length).toBe(1);
  });

  it('should handle mixed folder-based and pure route nodes', async () => {
    // Mix of physical folders and pure routes
    const manifest: Manifest = {
      sessionId: 's',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      pages: [
        // Physical folder: /docs
        {
          id: '1',
          route: '/docs/installation',
          title: 'Installation',
          publishedAt: new Date(),
          slug: Slug.from('installation'),
        },
        // Pure route: /guides
        {
          id: '2',
          route: '/guides/quickstart',
          title: 'Quick Start',
          publishedAt: new Date(),
          slug: Slug.from('quickstart'),
        },
      ],
    };

    const handler = new BuildTreeHandler();
    const tree = await handler.handle(manifest);

    // Both should appear as folders in the tree
    expect(tree.children?.length).toBe(2);

    const docs = tree.children?.find((c) => c.name === 'docs');
    expect(docs?.kind).toBe('folder');

    const guides = tree.children?.find((c) => c.name === 'guides');
    expect(guides?.kind).toBe('folder');

    // User shouldn't be able to tell the difference
    // between physical folders and pure routes in the UI
  });

  it('should handle pure route with customIndexFile', async () => {
    // Pure route with a custom index page
    const manifest: Manifest = {
      sessionId: 's',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      pages: [
        {
          id: '1',
          route: '/tutorials/index',
          title: 'Tutorials Home',
          publishedAt: new Date(),
          slug: Slug.from('index'),
          isCustomIndex: true, // Custom index file
        },
        {
          id: '2',
          route: '/tutorials/beginner',
          title: 'Beginner Tutorial',
          publishedAt: new Date(),
          slug: Slug.from('beginner'),
        },
      ],
    };

    const handler = new BuildTreeHandler();
    const tree = await handler.handle(manifest);

    const tutorials = tree.children?.find((c) => c.name === 'tutorials');
    expect(tutorials).toBeDefined();

    // Custom index should not appear as a child file
    const files = tutorials?.children?.filter((c) => c.kind === 'file') ?? [];
    expect(files.length).toBe(1);
    expect(files[0].name).toBe('beginner');
  });
});
