import type { CustomIndexConfig } from './custom-index-config';
import type { FolderConfig } from './folder-config';
import type { RouteNode, RouteTreeConfig } from './route-node';
import type { VpsConfig } from './vps-config';

/**
 * Migration utility: convert legacy FolderConfig[] to RouteTreeConfig
 *
 * BREAKING CHANGE: This function transforms the old "folder-first" model
 * into the new "route-first" model.
 *
 * Strategy:
 * - Each FolderConfig becomes a RouteNode
 * - routeBase is parsed into route segments to build tree structure
 * - IDs are preserved when possible for stability
 * - Folder properties (vaultFolder, flattenTree, etc.) are attached to nodes
 *
 * @param legacyFolders - Old FolderConfig[] array
 * @returns New RouteTreeConfig
 */
export function migrateLegacyFoldersToRouteTree(legacyFolders: FolderConfig[]): RouteTreeConfig {
  const roots: RouteNode[] = [];
  const nodeMap = new Map<string, RouteNode>(); // path -> node ('' for the root route "/")
  const folderNodes = new Set<RouteNode>(); // nodes already carrying a legacy folder

  for (const folder of legacyFolders) {
    const routePath = normalizeRoutePath(folder.routeBase);
    const segments = routePath.split('/').filter(Boolean);

    if (segments.length === 0) {
      // Root route: "/". Only one root route is valid, later folders merge into it.
      const existingRoot = nodeMap.get('');
      if (existingRoot) {
        mergeFolderIntoNode(existingRoot, folder, folderNodes);
      } else {
        const rootNode = createFolderNode(folder, '');
        folderNodes.add(rootNode);
        roots.push(rootNode);
        nodeMap.set('', rootNode);
      }
    } else {
      // Build nested structure
      let currentPath = '';
      let parentNode: RouteNode | null = null;

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const isLeaf = i === segments.length - 1;
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;

        let node = nodeMap.get(currentPath);

        if (!node) {
          if (isLeaf) {
            node = createFolderNode(folder, segment);
            folderNodes.add(node);
          } else {
            // Intermediate (pure route) node
            node = {
              id: `route-${currentPath.replace(/\//g, '-')}`,
              segment,
              ignoredCleanupRuleIds: [],
              children: [],
            };
          }

          nodeMap.set(currentPath, node);

          // Attach to parent or roots
          if (parentNode) {
            parentNode.children = parentNode.children || [];
            parentNode.children.push(node);
          } else {
            roots.push(node);
          }
        } else if (isLeaf) {
          // Node already exists: created as an intermediate node for a deeper
          // folder (e.g. "/a" after "/a/b"), or by another folder on the same route.
          mergeFolderIntoNode(node, folder, folderNodes);
        }

        parentNode = node;
      }
    }
  }

  return { roots };
}

function createFolderNode(folder: FolderConfig, segment: string): RouteNode {
  return {
    id: folder.id, // Preserve original ID
    segment,
    vaultFolder: folder.vaultFolder,
    customIndexFile: folder.customIndexFile,
    additionalFiles: folder.additionalFiles,
    flattenTree: folder.flattenTree,
    ignoredCleanupRuleIds: folder.ignoredCleanupRuleIds,
    children: [],
  };
}

/**
 * Attach a legacy folder to an existing node without losing anything already set.
 *
 * - An intermediate node takes the folder ID, as a leaf created for it would.
 * - Values already set on the node win (first folder wins on a real conflict);
 *   an empty or missing value never overwrites a set one.
 * - List values are merged without duplicates.
 */
function mergeFolderIntoNode(
  node: RouteNode,
  folder: FolderConfig,
  folderNodes: Set<RouteNode>
): void {
  if (!folderNodes.has(node)) {
    node.id = folder.id;
    folderNodes.add(node);
  }

  node.vaultFolder = node.vaultFolder || folder.vaultFolder;
  node.customIndexFile = node.customIndexFile || folder.customIndexFile;
  node.flattenTree = node.flattenTree ?? folder.flattenTree;
  node.additionalFiles = mergeUnique(node.additionalFiles, folder.additionalFiles);
  node.ignoredCleanupRuleIds = mergeUnique(
    node.ignoredCleanupRuleIds,
    folder.ignoredCleanupRuleIds
  );
}

function mergeUnique(first?: string[], second?: string[]): string[] | undefined {
  if (!first && !second) return undefined;
  return Array.from(new Set([...(first ?? []), ...(second ?? [])]));
}

/**
 * Migration-only shape of a VPS as saved before the route-first model.
 * The legacy fields are not part of the public `VpsConfig` anymore; they are
 * only read once from the raw saved settings to build the route tree.
 */
export interface LegacyVpsConfig extends VpsConfig {
  /** Legacy folder configuration (folder-first model) */
  folders?: FolderConfig[];

  /** Legacy custom indexes, moved to `RouteNode.customIndexFile` */
  customIndexes?: CustomIndexConfig[];
}

export interface LegacyVpsMigrationResult {
  /** VPS without legacy fields */
  vps: VpsConfig;

  /** True when legacy folders were converted to a new route tree */
  migrated: boolean;
}

/**
 * One-time migration of a saved VPS: legacy `folders` (and `customIndexes`)
 * become a `routeTree` when the VPS has none. An existing `routeTree` is kept
 * as is. Legacy fields are always dropped from the result.
 *
 * @param legacyVps - VPS as read from the raw saved settings
 */
export function migrateLegacyVpsConfig(legacyVps: LegacyVpsConfig): LegacyVpsMigrationResult {
  const { folders, customIndexes, ...vps } = legacyVps;

  if ((vps.routeTree?.roots?.length ?? 0) > 0 || !folders || folders.length === 0) {
    return { vps, migrated: false };
  }

  const routeTree = migrateLegacyFoldersToRouteTree(folders);
  if (customIndexes && customIndexes.length > 0) {
    applyCustomIndexesToRouteTree(routeTree, customIndexes);
  }

  return { vps: { ...vps, routeTree }, migrated: true };
}

/**
 * Reverse migration: convert RouteTreeConfig to FolderConfig[]
 * Useful for temporary backward compatibility or export
 *
 * @param routeTree - New RouteTreeConfig
 * @param vpsId - VPS ID to assign to generated FolderConfig items
 * @returns Legacy FolderConfig[]
 */
export function migrateRouteTreeToLegacyFolders(
  routeTree: RouteTreeConfig,
  vpsId: string
): FolderConfig[] {
  const folders: FolderConfig[] = [];

  const traverse = (node: RouteNode, pathSegments: string[]) => {
    const currentSegments = [...pathSegments, node.segment].filter(Boolean);

    // Only generate FolderConfig if this node has a vaultFolder attached
    if (node.vaultFolder) {
      const routeBase = currentSegments.length > 0 ? `/${currentSegments.join('/')}` : '/';

      folders.push({
        id: node.id,
        vpsId,
        vaultFolder: node.vaultFolder,
        routeBase,
        displayName: node.displayName, // Propagate displayName from RouteNode
        ignoredCleanupRuleIds: node.ignoredCleanupRuleIds || [],
        customIndexFile: node.customIndexFile,
        flattenTree: node.flattenTree,
        additionalFiles: node.additionalFiles,
      });
    }

    // Traverse children
    if (node.children) {
      for (const child of node.children) {
        traverse(child, currentSegments);
      }
    }
  };

  for (const root of routeTree.roots) {
    traverse(root, []);
  }

  return folders;
}

/**
 * Normalize route path for consistent parsing
 * - Ensures leading slash
 * - Removes trailing slash
 * - Trims whitespace
 */
function normalizeRoutePath(routePath: string): string {
  if (!routePath) return '';
  let normalized = routePath.trim();
  if (!normalized.startsWith('/')) normalized = '/' + normalized;
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * Apply custom indexes from LegacyVpsConfig.customIndexes to route tree
 * Migrates legacy customIndexes array to per-node customIndexFile
 *
 * @param routeTree - Route tree to update
 * @param customIndexes - Legacy custom indexes array from LegacyVpsConfig
 */
export function applyCustomIndexesToRouteTree(
  routeTree: RouteTreeConfig,
  customIndexes: { folderPath: string; indexFilePath: string }[]
): void {
  if (!customIndexes || customIndexes.length === 0) return;

  // Build a map of folderPath (normalized) -> indexFilePath
  const indexMap = new Map<string, string>();
  for (const config of customIndexes) {
    const normalizedPath = normalizeRoutePath(config.folderPath);
    indexMap.set(normalizedPath, config.indexFilePath);
  }

  // Traverse tree and apply customIndexFile to matching nodes
  const applyToNode = (node: RouteNode, currentPath: string) => {
    const nodePath = currentPath ? `${currentPath}/${node.segment}` : `/${node.segment}`;
    const normalizedNodePath = normalizeRoutePath(nodePath);

    // Check if this node matches a custom index config
    if (indexMap.has(normalizedNodePath)) {
      node.customIndexFile = indexMap.get(normalizedNodePath);
    }

    // Recursively apply to children
    if (node.children) {
      for (const child of node.children) {
        applyToNode(child, normalizedNodePath);
      }
    }
  };

  // Apply to all roots
  for (const root of routeTree.roots) {
    // Root node check (empty segment = "/")
    const rootPath = root.segment === '' ? '/' : `/${root.segment}`;
    const normalizedRootPath = normalizeRoutePath(rootPath);

    if (indexMap.has(normalizedRootPath)) {
      root.customIndexFile = indexMap.get(normalizedRootPath);
    }

    // Process children
    if (root.children) {
      for (const child of root.children) {
        applyToNode(child, normalizedRootPath);
      }
    }
  }
}
