import type { RouteNode, RouteTreeConfig } from '../entities/route-node';

/**
 * Collect all displayNames from a route tree into a Record<string, string>
 * where the key is the full route path and the value is the displayName
 *
 * @param routeTree Route tree configuration
 * @returns Record of route paths to display names
 */
export function collectDisplayNamesFromRouteTree(
  routeTree: RouteTreeConfig
): Record<string, string> {
  const displayNames: Record<string, string> = {};

  function traverse(node: RouteNode, parentPath: string): void {
    // Build current route path, handling empty segments properly
    let currentPath: string;

    if (!node.segment) {
      // Empty segment: this is the root route "/"
      currentPath = '/';
    } else if (!parentPath || parentPath === '/') {
      // Root level node with non-empty segment
      currentPath = `/${node.segment}`;
    } else {
      // Nested node
      currentPath = `${parentPath}/${node.segment}`;
    }

    // Add displayName if present (for ANY node, regardless of vaultFolder)
    if (node.displayName) {
      displayNames[currentPath] = node.displayName;
    }

    // Recursively traverse children
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        traverse(child, currentPath);
      }
    }
  }

  // Traverse all roots
  for (const root of routeTree.roots) {
    traverse(root, '');
  }

  return displayNames;
}
