import type { FolderConfig } from '../../entities/folder-config';
import {
  migrateLegacyFoldersToRouteTree,
  migrateRouteTreeToLegacyFolders,
} from '../../entities/route-node-migration';
import type { RouteNode, RouteTreeConfig } from '../../entities/route-node';

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
