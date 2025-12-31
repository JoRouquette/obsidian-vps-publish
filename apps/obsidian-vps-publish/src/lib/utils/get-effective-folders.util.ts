import type { FolderConfig, RouteNode, RouteTreeConfig, VpsConfig } from '@core-domain';

/**
 * Extract effective FolderConfig[] from VpsConfig
 *
 * This utility provides backward compatibility during the transition period.
 * It returns:
 * - routeTree-derived folders if routeTree is present
 * - legacy folders if routeTree is not present
 *
 * @param vps - VpsConfig (with either routeTree or folders)
 * @returns FolderConfig[] for consumption by existing code
 */
export function getEffectiveFolders(vps: VpsConfig): FolderConfig[] {
  if (vps.routeTree) {
    return extractFoldersFromRouteTree(vps.routeTree, vps.id);
  }

  // Fallback to legacy folders
  return vps.folders || [];
}

/**
 * Extract FolderConfig[] from RouteTreeConfig
 *
 * Traverses the route tree and generates FolderConfig for each node
 * that has a vaultFolder attached.
 *
 * @param routeTree - Route tree configuration
 * @param vpsId - VPS ID to assign to generated folders
 * @returns FolderConfig[] with computed routeBase from tree structure
 */
function extractFoldersFromRouteTree(routeTree: RouteTreeConfig, vpsId: string): FolderConfig[] {
  const folders: FolderConfig[] = [];

  const traverse = (node: RouteNode, pathSegments: string[]) => {
    const currentSegments = [...pathSegments, node.segment].filter(Boolean);

    // Generate FolderConfig if this node has a vaultFolder
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
