import type { RouteNode, RouteTreeConfig } from './route-node';

/**
 * Route validation error with conflict details
 */
export interface RouteConflict {
  type: 'duplicate-segment' | 'duplicate-path' | 'empty-segment';
  message: string;
  conflictingNodes: {
    id: string;
    segment: string;
    fullPath: string;
  }[];
  path: string;
}

/**
 * Validation result for a route tree
 */
export interface RouteValidationResult {
  valid: boolean;
  conflicts: RouteConflict[];
}

/**
 * Validates a route tree for conflicts and duplicates
 */
export function validateRouteTree(routeTree: RouteTreeConfig): RouteValidationResult {
  const conflicts: RouteConflict[] = [];
  const pathRegistry = new Map<string, RouteNode[]>(); // Track all full paths
  const processedDuplicates = new Set<string>(); // Track already reported duplicate segments

  // Normalize segment (remove leading/trailing slashes, trim)
  function normalizeSegment(segment: string | undefined): string {
    if (!segment) return '';
    return segment.replace(/^\/+|\/+$/g, '').trim();
  }

  // Recursive validation
  function validateNode(node: RouteNode, parentPath: string, siblings: RouteNode[]): void {
    const normalizedSegment = normalizeSegment(node.segment);

    // 1. Check for empty segments (root nodes with empty segment are allowed)
    if (parentPath !== '' && normalizedSegment === '') {
      conflicts.push({
        type: 'empty-segment',
        message: 'Route segment cannot be empty',
        conflictingNodes: [
          {
            id: node.id,
            segment: node.segment || '',
            fullPath: parentPath,
          },
        ],
        path: parentPath,
      });
      return; // Skip further validation for this node
    }

    // 2. Build full path
    const currentPath =
      parentPath === '' ? `/${normalizedSegment}` : `${parentPath}/${normalizedSegment}`;
    const normalizedPath = currentPath.replace(/\/+/g, '/'); // Normalize multiple slashes

    // 3. Check for duplicate segments at same level (only once per group)
    const normalizedSiblings = siblings.map((s) => ({
      ...s,
      normalizedSegment: normalizeSegment(s.segment),
    }));

    const duplicatesAtLevel = normalizedSiblings.filter(
      (sibling) => sibling.id !== node.id && sibling.normalizedSegment === normalizedSegment
    );

    if (duplicatesAtLevel.length > 0) {
      // Create a unique key for this duplicate group to avoid reporting it multiple times
      const duplicateGroupKey = `${parentPath}|${normalizedSegment}`;

      if (!processedDuplicates.has(duplicateGroupKey)) {
        processedDuplicates.add(duplicateGroupKey);

        // Collect all nodes with this segment (including current)
        const allDuplicates = normalizedSiblings.filter(
          (s) => s.normalizedSegment === normalizedSegment
        );

        conflicts.push({
          type: 'duplicate-segment',
          message: `Duplicate segment "${normalizedSegment}" at same level`,
          conflictingNodes: allDuplicates.map((s) => ({
            id: s.id,
            segment: s.segment || '',
            fullPath: normalizedPath,
          })),
          path: normalizedPath,
        });
      }
    }

    // 4. Register path
    if (!pathRegistry.has(normalizedPath)) {
      pathRegistry.set(normalizedPath, []);
    }
    pathRegistry.get(normalizedPath)!.push(node);

    // 5. Recursively validate children
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        validateNode(child, normalizedPath, node.children);
      }
    }
  }

  // Validate all root nodes
  if (routeTree.roots && routeTree.roots.length > 0) {
    for (const root of routeTree.roots) {
      validateNode(root, '', routeTree.roots);
    }
  }

  // Check for duplicate full paths across different branches
  for (const [path, nodes] of pathRegistry.entries()) {
    if (nodes.length > 1) {
      conflicts.push({
        type: 'duplicate-path',
        message: `Multiple routes map to the same path "${path}"`,
        conflictingNodes: nodes.map((n) => ({
          id: n.id,
          segment: n.segment || '',
          fullPath: path,
        })),
        path,
      });
    }
  }

  return {
    valid: conflicts.length === 0,
    conflicts,
  };
}

/**
 * Get conflicts for a specific node by its ID
 */
export function getNodeConflicts(routeTree: RouteTreeConfig, nodeId: string): RouteConflict[] {
  const result = validateRouteTree(routeTree);
  return result.conflicts.filter((conflict) =>
    conflict.conflictingNodes.some((n) => n.id === nodeId)
  );
}

/**
 * Check if a specific node has conflicts
 */
export function hasNodeConflicts(routeTree: RouteTreeConfig, nodeId: string): boolean {
  return getNodeConflicts(routeTree, nodeId).length > 0;
}
