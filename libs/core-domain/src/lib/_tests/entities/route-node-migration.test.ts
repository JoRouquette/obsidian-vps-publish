import type { FolderConfig } from '../../entities/folder-config';
import type { RouteNode, RouteTreeConfig } from '../../entities/route-node';
import {
  type LegacyVpsConfig,
  migrateLegacyFoldersToRouteTree,
  migrateLegacyVpsConfig,
  migrateRouteTreeToLegacyFolders,
} from '../../entities/route-node-migration';
import { validateRouteTree } from '../../entities/route-node-validation';

describe('Route Node Migration', () => {
  describe('migrateLegacyFoldersToRouteTree', () => {
    it('should convert single root folder to route tree', () => {
      const legacy: FolderConfig[] = [
        {
          id: 'folder-1',
          vpsId: 'vps-1',
          vaultFolder: 'Notes',
          routeBase: '/',
          ignoredCleanupRuleIds: [],
        },
      ];

      const result = migrateLegacyFoldersToRouteTree(legacy);

      expect(result.roots).toHaveLength(1);
      expect(result.roots[0]).toMatchObject({
        id: 'folder-1',
        segment: '',
        vaultFolder: 'Notes',
        ignoredCleanupRuleIds: [],
      });
    });

    it('should convert flat folders to nested tree structure', () => {
      const legacy: FolderConfig[] = [
        {
          id: 'folder-blog',
          vpsId: 'vps-1',
          vaultFolder: 'Blog',
          routeBase: '/blog',
          ignoredCleanupRuleIds: [],
        },
        {
          id: 'folder-docs',
          vpsId: 'vps-1',
          vaultFolder: 'Documentation',
          routeBase: '/docs',
          ignoredCleanupRuleIds: [],
        },
      ];

      const result = migrateLegacyFoldersToRouteTree(legacy);

      expect(result.roots).toHaveLength(2);
      expect(result.roots[0]).toMatchObject({
        id: 'folder-blog',
        segment: 'blog',
        vaultFolder: 'Blog',
      });
      expect(result.roots[1]).toMatchObject({
        id: 'folder-docs',
        segment: 'docs',
        vaultFolder: 'Documentation',
      });
    });

    it('should build nested structure for deep routes', () => {
      const legacy: FolderConfig[] = [
        {
          id: 'folder-characters',
          vpsId: 'vps-1',
          vaultFolder: 'Lore/Characters',
          routeBase: '/lore/characters',
          ignoredCleanupRuleIds: [],
        },
      ];

      const result = migrateLegacyFoldersToRouteTree(legacy);

      expect(result.roots).toHaveLength(1);

      const loreNode = result.roots[0];
      expect(loreNode.segment).toBe('lore');
      expect(loreNode.vaultFolder).toBeUndefined(); // Intermediate node

      expect(loreNode.children).toHaveLength(1);
      const charactersNode = loreNode.children![0];
      expect(charactersNode).toMatchObject({
        id: 'folder-characters',
        segment: 'characters',
        vaultFolder: 'Lore/Characters',
      });
    });

    it('should preserve all folder properties', () => {
      const legacy: FolderConfig[] = [
        {
          id: 'folder-1',
          vpsId: 'vps-1',
          vaultFolder: 'Content',
          routeBase: '/content',
          ignoredCleanupRuleIds: ['rule-1', 'rule-2'],
          customIndexFile: 'indexes/content-index.md',
          flattenTree: true,
          additionalFiles: ['extra/file1.md', 'extra/file2.md'],
        },
      ];

      const result = migrateLegacyFoldersToRouteTree(legacy);

      expect(result.roots[0]).toMatchObject({
        id: 'folder-1',
        segment: 'content',
        vaultFolder: 'Content',
        ignoredCleanupRuleIds: ['rule-1', 'rule-2'],
        customIndexFile: 'indexes/content-index.md',
        flattenTree: true,
        additionalFiles: ['extra/file1.md', 'extra/file2.md'],
      });
    });

    it('should handle route normalization (trailing slash, no leading slash)', () => {
      const legacy: FolderConfig[] = [
        {
          id: 'folder-1',
          vpsId: 'vps-1',
          vaultFolder: 'Notes',
          routeBase: 'notes/', // No leading slash, has trailing slash
          ignoredCleanupRuleIds: [],
        },
      ];

      const result = migrateLegacyFoldersToRouteTree(legacy);

      expect(result.roots[0].segment).toBe('notes');
    });

    it('should create intermediate nodes for shared prefixes', () => {
      const legacy: FolderConfig[] = [
        {
          id: 'folder-fauna',
          vpsId: 'vps-1',
          vaultFolder: 'World/Fauna',
          routeBase: '/le-vivant/faune',
          ignoredCleanupRuleIds: [],
        },
        {
          id: 'folder-flora',
          vpsId: 'vps-1',
          vaultFolder: 'World/Flora',
          routeBase: '/le-vivant/flore',
          ignoredCleanupRuleIds: [],
        },
      ];

      const result = migrateLegacyFoldersToRouteTree(legacy);

      expect(result.roots).toHaveLength(1);
      const leVivantNode = result.roots[0];
      expect(leVivantNode.segment).toBe('le-vivant');
      expect(leVivantNode.vaultFolder).toBeUndefined();

      expect(leVivantNode.children).toHaveLength(2);
      const fauneNode = leVivantNode.children!.find((c: RouteNode) => c.segment === 'faune');
      const floreNode = leVivantNode.children!.find((c: RouteNode) => c.segment === 'flore');

      expect(fauneNode).toMatchObject({
        id: 'folder-fauna',
        vaultFolder: 'World/Fauna',
      });
      expect(floreNode).toMatchObject({
        id: 'folder-flora',
        vaultFolder: 'World/Flora',
      });
    });

    it('should merge several folders on "/" into a single valid root route', () => {
      const legacy: FolderConfig[] = [
        {
          id: 'folder-default',
          vpsId: 'vps-1',
          vaultFolder: '',
          routeBase: '/',
          ignoredCleanupRuleIds: ['rule-1'],
        },
        {
          id: 'folder-notes',
          vpsId: 'vps-1',
          vaultFolder: 'Notes',
          routeBase: '/',
          ignoredCleanupRuleIds: ['rule-1', 'rule-2'],
          customIndexFile: 'indexes/home.md',
          flattenTree: true,
          additionalFiles: ['extra.md'],
        },
      ];

      const result = migrateLegacyFoldersToRouteTree(legacy);

      expect(result.roots).toHaveLength(1);
      expect(result.roots[0]).toMatchObject({
        id: 'folder-default',
        segment: '',
        vaultFolder: 'Notes',
        customIndexFile: 'indexes/home.md',
        flattenTree: true,
        additionalFiles: ['extra.md'],
        ignoredCleanupRuleIds: ['rule-1', 'rule-2'],
      });
      expect(validateRouteTree(result).valid).toBe(true);
    });

    it('should keep the first folder settings when two folders on "/" conflict', () => {
      const legacy: FolderConfig[] = [
        {
          id: 'folder-a',
          vpsId: 'vps-1',
          vaultFolder: 'A',
          routeBase: '/',
          ignoredCleanupRuleIds: [],
          flattenTree: false,
        },
        {
          id: 'folder-b',
          vpsId: 'vps-1',
          vaultFolder: 'B',
          routeBase: '/',
          ignoredCleanupRuleIds: [],
          flattenTree: true,
        },
      ];

      const result = migrateLegacyFoldersToRouteTree(legacy);

      expect(result.roots).toHaveLength(1);
      expect(result.roots[0]).toMatchObject({
        id: 'folder-a',
        vaultFolder: 'A',
        flattenTree: false,
      });
    });

    it('should not lose a parent folder declared after its child ([/a/b, /a])', () => {
      const legacy: FolderConfig[] = [
        {
          id: 'folder-ab',
          vpsId: 'vps-1',
          vaultFolder: 'A/B',
          routeBase: '/a/b',
          ignoredCleanupRuleIds: [],
        },
        {
          id: 'folder-a',
          vpsId: 'vps-1',
          vaultFolder: 'A',
          routeBase: '/a',
          ignoredCleanupRuleIds: ['rule-1'],
          customIndexFile: 'indexes/a.md',
          flattenTree: true,
          additionalFiles: ['a-extra.md'],
        },
      ];

      const result = migrateLegacyFoldersToRouteTree(legacy);

      expect(result.roots).toHaveLength(1);
      const aNode = result.roots[0];
      expect(aNode).toMatchObject({
        id: 'folder-a',
        segment: 'a',
        vaultFolder: 'A',
        customIndexFile: 'indexes/a.md',
        flattenTree: true,
        additionalFiles: ['a-extra.md'],
        ignoredCleanupRuleIds: ['rule-1'],
      });
      expect(aNode.children).toHaveLength(1);
      expect(aNode.children![0]).toMatchObject({
        id: 'folder-ab',
        segment: 'b',
        vaultFolder: 'A/B',
      });
      expect(validateRouteTree(result).valid).toBe(true);
    });

    it('should produce the same tree whatever the order of parent and child folders', () => {
      const parent: FolderConfig = {
        id: 'folder-a',
        vpsId: 'vps-1',
        vaultFolder: 'A',
        routeBase: '/a',
        ignoredCleanupRuleIds: ['rule-1'],
        flattenTree: true,
      };
      const child: FolderConfig = {
        id: 'folder-ab',
        vpsId: 'vps-1',
        vaultFolder: 'A/B',
        routeBase: '/a/b',
        ignoredCleanupRuleIds: [],
      };

      const childFirst = migrateLegacyFoldersToRouteTree([child, parent]);
      const parentFirst = migrateLegacyFoldersToRouteTree([parent, child]);

      expect(childFirst).toEqual(parentFirst);
    });

    describe('deep chains and repeated routes', () => {
      const folder = (id: string, vaultFolder: string, routeBase: string): FolderConfig => ({
        id,
        vpsId: 'vps-1',
        vaultFolder,
        routeBase,
        ignoredCleanupRuleIds: [`rule-${id}`],
        flattenTree: id === 'b',
      });

      function findNode(roots: RouteNode[], ...segments: string[]): RouteNode | undefined {
        let level: RouteNode[] = roots;
        let node: RouteNode | undefined;
        for (const segment of segments) {
          node = level.find((candidate) => candidate.segment === segment);
          level = node?.children ?? [];
        }
        return node;
      }

      it('should promote every intermediate node declared after its descendants', () => {
        const { roots } = migrateLegacyFoldersToRouteTree([
          folder('c', 'A/B/C', '/a/b/c'),
          folder('b', 'A/B', '/a/b'),
          folder('a', 'A', '/a'),
        ]);

        expect(validateRouteTree({ roots }).valid).toBe(true);
        expect(roots).toHaveLength(1);
        expect(findNode(roots, 'a')).toMatchObject({
          id: 'a',
          vaultFolder: 'A',
          ignoredCleanupRuleIds: ['rule-a'],
        });
        expect(findNode(roots, 'a', 'b')).toMatchObject({
          id: 'b',
          vaultFolder: 'A/B',
          flattenTree: true,
          ignoredCleanupRuleIds: ['rule-b'],
        });
        expect(findNode(roots, 'a', 'b', 'c')).toMatchObject({ id: 'c', vaultFolder: 'A/B/C' });
      });

      it('should give the same tree for every order of a three-level chain', () => {
        const chain = [
          folder('a', 'A', '/a'),
          folder('b', 'A/B', '/a/b'),
          folder('c', 'A/B/C', '/a/b/c'),
        ];
        const orders = [
          [0, 1, 2],
          [0, 2, 1],
          [1, 0, 2],
          [1, 2, 0],
          [2, 0, 1],
          [2, 1, 0],
        ];

        const trees = orders.map((order) =>
          migrateLegacyFoldersToRouteTree(order.map((index) => chain[index]))
        );

        for (const tree of trees) {
          expect(tree).toEqual(trees[0]);
        }
      });

      it('should keep sibling routes separate when the parent is declared between them', () => {
        const { roots } = migrateLegacyFoldersToRouteTree([
          folder('b', 'A/B', '/a/b'),
          folder('a', 'A', '/a'),
          folder('c', 'A/C', '/a/c'),
        ]);

        expect(roots).toHaveLength(1);
        expect(roots[0].children?.map((child) => child.segment)).toEqual(['b', 'c']);
        expect(roots[0]).toMatchObject({ id: 'a', vaultFolder: 'A' });
      });

      it('should read the same route twice as a single node', () => {
        const { roots } = migrateLegacyFoldersToRouteTree([
          folder('a1', 'A', '/a'),
          folder('a2', 'A', '/a'),
        ]);

        expect(roots).toHaveLength(1);
        expect(roots[0]).toMatchObject({
          vaultFolder: 'A',
          ignoredCleanupRuleIds: ['rule-a1', 'rule-a2'],
        });
      });

      it('should read " a" and "a" as the same route', () => {
        const { roots } = migrateLegacyFoldersToRouteTree([
          folder('a1', 'A', '/ a'),
          folder('a2', 'A', '/a'),
        ]);

        expect(roots).toHaveLength(1);
        expect(validateRouteTree({ roots }).valid).toBe(true);
      });
    });

    describe('conflict warnings', () => {
      const base = { vpsId: 'vps-1', ignoredCleanupRuleIds: [] as string[] };

      it('should report the vault folder dropped when two folders on "/" differ', () => {
        const warnings: string[] = [];

        migrateLegacyFoldersToRouteTree(
          [
            { ...base, id: 'f1', vaultFolder: 'Home', routeBase: '/' },
            { ...base, id: 'f2', vaultFolder: 'Elsewhere', routeBase: '/' },
          ],
          (message) => warnings.push(message)
        );

        expect(warnings).toEqual(['Route "/": vault folder "Elsewhere" ignored, "Home" kept']);
      });

      it('should report a custom index dropped on a repeated route', () => {
        const warnings: string[] = [];

        migrateLegacyFoldersToRouteTree(
          [
            { ...base, id: 'f1', vaultFolder: 'A', routeBase: '/a', customIndexFile: 'one.md' },
            { ...base, id: 'f2', vaultFolder: 'A', routeBase: '/a', customIndexFile: 'two.md' },
          ],
          (message) => warnings.push(message)
        );

        expect(warnings).toEqual(['Route "/a": custom index "two.md" ignored, "one.md" kept']);
      });

      it('should stay silent when nothing is lost', () => {
        const warnings: string[] = [];

        migrateLegacyFoldersToRouteTree(
          [
            { ...base, id: 'f1', vaultFolder: '', routeBase: '/' },
            { ...base, id: 'f2', vaultFolder: 'Home', routeBase: '/' },
            { ...base, id: 'f3', vaultFolder: 'A', routeBase: '/a' },
            { ...base, id: 'f4', vaultFolder: 'A', routeBase: '/a' },
          ],
          (message) => warnings.push(message)
        );

        expect(warnings).toEqual([]);
      });
    });
  });

  describe('migrateLegacyVpsConfig', () => {
    function createSavedLegacyVps(overrides: Partial<LegacyVpsConfig> = {}): LegacyVpsConfig {
      return {
        id: 'vps-1',
        name: 'Legacy VPS',
        baseUrl: 'https://example.com',
        apiKey: 'enc:key',
        ignoreRules: [],
        cleanupRules: [],
        folders: [
          {
            id: 'folder-blog',
            vpsId: 'vps-1',
            vaultFolder: 'Blog',
            routeBase: '/blog',
            ignoredCleanupRuleIds: [],
          },
        ],
        customIndexes: [{ id: 'idx-1', folderPath: '/blog', indexFilePath: 'indexes/blog.md' }],
        ...overrides,
      };
    }

    it('should migrate saved legacy folders and custom indexes to a route tree', () => {
      const { vps, migrated } = migrateLegacyVpsConfig(createSavedLegacyVps());

      expect(migrated).toBe(true);
      expect(vps).not.toHaveProperty('folders');
      expect(vps).not.toHaveProperty('customIndexes');
      expect(vps).toMatchObject({ id: 'vps-1', name: 'Legacy VPS', apiKey: 'enc:key' });
      expect(vps.routeTree?.roots).toEqual([
        {
          id: 'folder-blog',
          segment: 'blog',
          vaultFolder: 'Blog',
          customIndexFile: 'indexes/blog.md',
          additionalFiles: undefined,
          flattenTree: undefined,
          ignoredCleanupRuleIds: [],
          children: [],
        },
      ]);
    });

    it('should keep an existing route tree untouched and drop ignored legacy fields', () => {
      const routeTree: RouteTreeConfig = {
        roots: [{ id: 'route-docs', segment: 'docs', vaultFolder: 'Docs' }],
      };

      const { vps, migrated } = migrateLegacyVpsConfig(createSavedLegacyVps({ routeTree }));

      expect(migrated).toBe(false);
      expect(vps.routeTree).toBe(routeTree);
      expect(vps).not.toHaveProperty('folders');
      expect(vps).not.toHaveProperty('customIndexes');
    });

    it('should migrate legacy folders when the saved route tree has no roots', () => {
      const { vps, migrated } = migrateLegacyVpsConfig(
        createSavedLegacyVps({ routeTree: { roots: [] } })
      );

      expect(migrated).toBe(true);
      expect(vps.routeTree?.roots.length).toBeGreaterThan(0);
      expect(vps).not.toHaveProperty('folders');
    });

    it('should not migrate a VPS without legacy folders', () => {
      const { vps, migrated } = migrateLegacyVpsConfig(
        createSavedLegacyVps({ folders: [], customIndexes: undefined })
      );

      expect(migrated).toBe(false);
      expect(vps.routeTree).toBeUndefined();
    });

    it('should migrate legacy folders saved next to the empty default root', () => {
      const { vps, migrated } = migrateLegacyVpsConfig(
        createSavedLegacyVps({
          routeTree: { roots: [{ id: 'default', segment: '', ignoredCleanupRuleIds: [] }] },
        })
      );

      expect(migrated).toBe(true);
      expect(vps.routeTree?.roots.map((root) => root.segment)).toEqual(['blog']);
    });

    it.each([
      ['a vault folder', { id: 'root', segment: '', vaultFolder: 'Home' }],
      ['a custom index', { id: 'root', segment: '', customIndexFile: 'home.md' }],
      ['a child route', { id: 'root', segment: '', children: [{ id: 'c', segment: 'c' }] }],
      ['a name and no vault folder', { id: 'root', segment: 'docs' }],
    ] as [string, RouteNode][])('should keep a root route that has %s', (_label, root) => {
      const routeTree: RouteTreeConfig = { roots: [root] };

      const { vps, migrated } = migrateLegacyVpsConfig(createSavedLegacyVps({ routeTree }));

      expect(migrated).toBe(false);
      expect(vps.routeTree).toBe(routeTree);
    });

    it('should be idempotent: a migrated VPS is not migrated again', () => {
      const first = migrateLegacyVpsConfig(createSavedLegacyVps());
      // The legacy folders are still present, as when the saved file was not rewritten.
      const second = migrateLegacyVpsConfig({
        ...(first.vps as LegacyVpsConfig),
        folders: createSavedLegacyVps().folders,
      });

      expect(first.migrated).toBe(true);
      expect(second.migrated).toBe(false);
      expect(second.vps.routeTree).toBe(first.vps.routeTree);
    });

    it('should treat a null root entry as no route and migrate', () => {
      const { migrated } = migrateLegacyVpsConfig(
        createSavedLegacyVps({ routeTree: { roots: [null] } as unknown as RouteTreeConfig })
      );

      expect(migrated).toBe(true);
    });

    it('should not throw on a conflict when no warning handler is given', () => {
      const folder = (id: string, vaultFolder: string): FolderConfig => ({
        id,
        vpsId: 'vps-1',
        vaultFolder,
        routeBase: '/a/b',
        ignoredCleanupRuleIds: [],
      });

      expect(() =>
        migrateLegacyVpsConfig(
          createSavedLegacyVps({
            folders: [folder('f1', 'One'), folder('f2', 'Two')],
            customIndexes: [{ id: 'i', folderPath: '/gone', indexFilePath: 'x.md' }],
          })
        )
      ).not.toThrow();
    });

    it('should name the nested route in a conflict warning', () => {
      const warnings: string[] = [];
      const folder = (id: string, vaultFolder: string): FolderConfig => ({
        id,
        vpsId: 'vps-1',
        vaultFolder,
        routeBase: '/a/b',
        ignoredCleanupRuleIds: [],
      });

      migrateLegacyVpsConfig(
        createSavedLegacyVps({
          folders: [folder('f1', 'One'), folder('f2', 'Two')],
          customIndexes: undefined,
        }),
        (message) => warnings.push(message)
      );

      expect(warnings).toEqual(['Route "/a/b": vault folder "Two" ignored, "One" kept']);
    });

    describe('saved data that is not trusted', () => {
      it.each([
        ['null', null],
        ['a string', 'folders'],
        ['an object', { 0: 'x' }],
      ])('should not throw when folders is %s', (_label, folders) => {
        const warnings: string[] = [];

        const { vps, migrated } = migrateLegacyVpsConfig(
          createSavedLegacyVps({ folders: folders as unknown as FolderConfig[] }),
          (message) => warnings.push(message)
        );

        expect(migrated).toBe(false);
        expect(vps.routeTree).toBeUndefined();
        expect(warnings).toEqual([]);
      });

      it('should skip unreadable folder entries, report them, and migrate the others', () => {
        const warnings: string[] = [];
        const readable = createSavedLegacyVps().folders as FolderConfig[];

        const { vps, migrated } = migrateLegacyVpsConfig(
          createSavedLegacyVps({
            folders: [
              null,
              42,
              { id: 'bad', vaultFolder: 'X', routeBase: 7 },
              ...readable,
            ] as unknown as FolderConfig[],
          }),
          (message) => warnings.push(message)
        );

        expect(migrated).toBe(true);
        expect(vps.routeTree?.roots.map((root) => root.segment)).toEqual(['blog']);
        expect(warnings).toHaveLength(3);
        expect(warnings.every((message) => message.startsWith('Legacy folder ignored'))).toBe(true);
      });

      it('should keep the VPS as saved when no folder entry is readable', () => {
        const legacy = createSavedLegacyVps({ folders: [null] as unknown as FolderConfig[] });

        const { vps, migrated } = migrateLegacyVpsConfig(legacy);

        expect(migrated).toBe(false);
        expect(vps).toBe(legacy);
      });

      it('should ignore unreadable custom indexes and report them', () => {
        const warnings: string[] = [];

        const { vps, migrated } = migrateLegacyVpsConfig(
          createSavedLegacyVps({
            customIndexes: [
              null,
              { id: 'x', folderPath: 3, indexFilePath: 'x.md' },
            ] as unknown as LegacyVpsConfig['customIndexes'],
          }),
          (message) => warnings.push(message)
        );

        expect(migrated).toBe(true);
        expect(vps.routeTree?.roots[0].customIndexFile).toBeUndefined();
        expect(warnings).toEqual(['Some legacy custom indexes are unreadable and were ignored']);
      });
    });

    it('should report a custom index that matches no route', () => {
      const warnings: string[] = [];

      const { vps } = migrateLegacyVpsConfig(
        createSavedLegacyVps({
          customIndexes: [
            { id: 'i1', folderPath: '/blog', indexFilePath: 'indexes/blog.md' },
            { id: 'i2', folderPath: '/gone', indexFilePath: 'indexes/gone.md' },
          ],
        }),
        (message) => warnings.push(message)
      );

      expect(vps.routeTree?.roots[0].customIndexFile).toBe('indexes/blog.md');
      expect(warnings).toEqual([
        'Legacy custom index for "/gone" matches no route and was ignored',
      ]);
    });

    it('should report the dropped vault folder when folders on "/" conflict', () => {
      const warnings: string[] = [];
      const folder = (id: string, vaultFolder: string): FolderConfig => ({
        id,
        vpsId: 'vps-1',
        vaultFolder,
        routeBase: '/',
        ignoredCleanupRuleIds: [],
      });

      migrateLegacyVpsConfig(
        createSavedLegacyVps({
          folders: [folder('f1', 'Home'), folder('f2', 'Other')],
          customIndexes: undefined,
        }),
        (message) => warnings.push(message)
      );

      expect(warnings).toEqual(['Route "/": vault folder "Other" ignored, "Home" kept']);
    });
  });

  describe('migrateRouteTreeToLegacyFolders', () => {
    it('should convert route tree back to flat folders', () => {
      const routeTree: RouteTreeConfig = {
        roots: [
          {
            id: 'folder-blog',
            segment: 'blog',
            vaultFolder: 'Blog',
            ignoredCleanupRuleIds: [],
          },
          {
            id: 'folder-docs',
            segment: 'docs',
            vaultFolder: 'Docs',
            ignoredCleanupRuleIds: [],
          },
        ],
      };

      const result = migrateRouteTreeToLegacyFolders(routeTree, 'vps-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'folder-blog',
        vpsId: 'vps-1',
        vaultFolder: 'Blog',
        routeBase: '/blog',
      });
      expect(result[1]).toMatchObject({
        id: 'folder-docs',
        vpsId: 'vps-1',
        vaultFolder: 'Docs',
        routeBase: '/docs',
      });
    });

    it('should flatten nested structure', () => {
      const routeTree: RouteTreeConfig = {
        roots: [
          {
            id: 'route-lore',
            segment: 'lore',
            ignoredCleanupRuleIds: [],
            children: [
              {
                id: 'folder-characters',
                segment: 'characters',
                vaultFolder: 'Lore/Characters',
                ignoredCleanupRuleIds: [],
              },
            ],
          },
        ],
      };

      const result = migrateRouteTreeToLegacyFolders(routeTree, 'vps-1');

      // Intermediate node (lore) has no vaultFolder, so it shouldn't generate a FolderConfig
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'folder-characters',
        vpsId: 'vps-1',
        vaultFolder: 'Lore/Characters',
        routeBase: '/lore/characters',
      });
    });

    it('should skip pure route nodes (no vaultFolder)', () => {
      const routeTree: RouteTreeConfig = {
        roots: [
          {
            id: 'route-lore',
            segment: 'lore',
            customIndexFile: 'indexes/lore.md',
            additionalFiles: ['lore-overview.md'],
            ignoredCleanupRuleIds: [],
          },
        ],
      };

      const result = migrateRouteTreeToLegacyFolders(routeTree, 'vps-1');

      // Pure route node (no vaultFolder) should not generate a FolderConfig
      expect(result).toHaveLength(0);
    });

    it('should preserve all properties in conversion', () => {
      const routeTree: RouteTreeConfig = {
        roots: [
          {
            id: 'folder-1',
            segment: 'content',
            vaultFolder: 'Content',
            ignoredCleanupRuleIds: ['rule-1'],
            customIndexFile: 'indexes/content.md',
            flattenTree: true,
            additionalFiles: ['extra.md'],
          },
        ],
      };

      const result = migrateRouteTreeToLegacyFolders(routeTree, 'vps-1');

      expect(result[0]).toMatchObject({
        id: 'folder-1',
        vpsId: 'vps-1',
        vaultFolder: 'Content',
        routeBase: '/content',
        ignoredCleanupRuleIds: ['rule-1'],
        customIndexFile: 'indexes/content.md',
        flattenTree: true,
        additionalFiles: ['extra.md'],
      });
    });
  });

  describe('Round-trip migration', () => {
    it('should preserve data through legacy -> tree -> legacy conversion', () => {
      const original: FolderConfig[] = [
        {
          id: 'folder-blog',
          vpsId: 'vps-1',
          vaultFolder: 'Blog',
          routeBase: '/blog',
          ignoredCleanupRuleIds: ['rule-1'],
          customIndexFile: 'indexes/blog.md',
          flattenTree: false,
          additionalFiles: ['extra.md'],
        },
      ];

      const tree = migrateLegacyFoldersToRouteTree(original);
      const restored = migrateRouteTreeToLegacyFolders(tree, 'vps-1');

      expect(restored).toHaveLength(1);
      expect(restored[0]).toMatchObject(original[0]);
    });
  });
});
