import type { FolderConfig } from './folder-config';
import type { RouteNode, RouteTreeConfig } from './route-node';

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
  const nodeMap = new Map<string, RouteNode>(); // path -> node

  for (const folder of legacyFolders) {
    const routePath = normalizeRoutePath(folder.routeBase);
    const segments = routePath.split('/').filter(Boolean);

    if (segments.length === 0) {
      // Root route: "/"
      const rootNode: RouteNode = {
        id: folder.id, // Preserve original ID
        segment: '',
        vaultFolder: folder.vaultFolder,
        customIndexFile: folder.customIndexFile,
        additionalFiles: folder.additionalFiles,
        flattenTree: folder.flattenTree,
        ignoredCleanupRuleIds: folder.ignoredCleanupRuleIds,
        children: [],
      };
      roots.push(rootNode);
      nodeMap.set('', rootNode);
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
          // Create new node
          node = {
            id: isLeaf ? folder.id : `route-${currentPath.replace(/\//g, '-')}`,
            segment,
            ignoredCleanupRuleIds: isLeaf ? folder.ignoredCleanupRuleIds : [],
            children: [],
          };

          // If leaf node, attach folder properties
          if (isLeaf) {
            node.vaultFolder = folder.vaultFolder;
            node.customIndexFile = folder.customIndexFile;
            node.additionalFiles = folder.additionalFiles;
            node.flattenTree = folder.flattenTree;
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
          // Node exists from another folder, merge properties
          // This can happen if multiple folders share the same routeBase
          // Route conflict: multiple folders map to same route - keeping first folder config
          // Silently ignore duplicate to avoid console pollution (logged in tests if needed)
        }

        parentNode = node;
      }
    }
  }

  return { roots };
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
 * Apply custom indexes from VpsConfig.customIndexes to route tree
 * Migrates legacy customIndexes array to per-node customIndexFile
 *
 * @param routeTree - Route tree to update
 * @param customIndexes - Legacy custom indexes array from VpsConfig
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
