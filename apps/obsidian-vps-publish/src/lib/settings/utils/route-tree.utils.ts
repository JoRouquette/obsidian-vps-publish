import type { RouteNode } from '@core-domain/entities/route-node';

/**
 * Find a node by ID in the tree (recursive)
 */
export function findNodeById(routeTree: { roots: RouteNode[] }, nodeId: string): RouteNode | null {
  // Check roots
  for (const root of routeTree.roots) {
    if (root.id === nodeId) return root;
    const found = findNodeInChildren(root, nodeId);
    if (found) return found;
  }
  return null;
}

/**
 * Find a node by ID in children (recursive)
 */
function findNodeInChildren(parent: RouteNode, nodeId: string): RouteNode | null {
  if (!parent.children) return null;

  for (const child of parent.children) {
    if (child.id === nodeId) return child;
    const found = findNodeInChildren(child, nodeId);
    if (found) return found;
  }

  return null;
}

/**
 * Find the parent node of a given node
 */
export function findParentNode(
  routeTree: { roots: RouteNode[] },
  nodeId: string
): RouteNode | null {
  // Check if it's a root (no parent)
  if (routeTree.roots.some((r) => r.id === nodeId)) {
    return null;
  }

  // Search in roots' children
  for (const root of routeTree.roots) {
    const parent = findParentInChildren(root, nodeId);
    if (parent) return parent;
  }

  return null;
}

/**
 * Find the parent node in children (recursive)
 */
function findParentInChildren(parent: RouteNode, nodeId: string): RouteNode | null {
  if (!parent.children) return null;

  // Check direct children
  if (parent.children.some((c) => c.id === nodeId)) {
    return parent;
  }

  // Check grandchildren
  for (const child of parent.children) {
    const found = findParentInChildren(child, nodeId);
    if (found) return found;
  }

  return null;
}

/**
 * Check if a node is a descendant of another node
 */
export function isDescendant(ancestor: RouteNode, descendantId: string): boolean {
  if (ancestor.id === descendantId) return true;
  if (!ancestor.children) return false;

  for (const child of ancestor.children) {
    if (isDescendant(child, descendantId)) return true;
  }

  return false;
}

/**
 * Remove a node from the tree without deleting it (returns the removed node)
 */
export function removeNodeFromTree(
  routeTree: { roots: RouteNode[] },
  nodeId: string
): RouteNode | null {
  // Check roots
  const rootIndex = routeTree.roots.findIndex((r) => r.id === nodeId);
  if (rootIndex !== -1) {
    return routeTree.roots.splice(rootIndex, 1)[0];
  }

  // Recursively check children
  for (const root of routeTree.roots) {
    const removed = removeNodeFromChildren(root, nodeId);
    if (removed) return removed;
  }

  return null;
}

/**
 * Remove a node from children (recursive, returns the removed node)
 */
function removeNodeFromChildren(parent: RouteNode, nodeId: string): RouteNode | null {
  if (!parent.children) return null;

  const childIndex = parent.children.findIndex((c) => c.id === nodeId);
  if (childIndex !== -1) {
    return parent.children.splice(childIndex, 1)[0];
  }

  // Recursively check grandchildren
  for (const child of parent.children) {
    const removed = removeNodeFromChildren(child, nodeId);
    if (removed) return removed;
  }

  return null;
}

/**
 * Insert a node before the target node
 */
export function insertNodeBefore(
  routeTree: { roots: RouteNode[] },
  targetId: string,
  nodeToInsert: RouteNode
): boolean {
  // Check if target is a root
  const rootIndex = routeTree.roots.findIndex((r) => r.id === targetId);
  if (rootIndex !== -1) {
    routeTree.roots.splice(rootIndex, 0, nodeToInsert);
    return true;
  }

  // Search in children
  for (const root of routeTree.roots) {
    if (insertNodeBeforeInChildren(root, targetId, nodeToInsert)) {
      return true;
    }
  }

  return false;
}

/**
 * Insert a node before the target in children (recursive)
 */
function insertNodeBeforeInChildren(
  parent: RouteNode,
  targetId: string,
  nodeToInsert: RouteNode
): boolean {
  if (!parent.children) return false;

  const childIndex = parent.children.findIndex((c) => c.id === targetId);
  if (childIndex !== -1) {
    parent.children.splice(childIndex, 0, nodeToInsert);
    return true;
  }

  // Recursively check grandchildren
  for (const child of parent.children) {
    if (insertNodeBeforeInChildren(child, targetId, nodeToInsert)) {
      return true;
    }
  }

  return false;
}

/**
 * Insert a node after the target node
 */
export function insertNodeAfter(
  routeTree: { roots: RouteNode[] },
  targetId: string,
  nodeToInsert: RouteNode
): boolean {
  // Check if target is a root
  const rootIndex = routeTree.roots.findIndex((r) => r.id === targetId);
  if (rootIndex !== -1) {
    routeTree.roots.splice(rootIndex + 1, 0, nodeToInsert);
    return true;
  }

  // Search in children
  for (const root of routeTree.roots) {
    if (insertNodeAfterInChildren(root, targetId, nodeToInsert)) {
      return true;
    }
  }

  return false;
}

/**
 * Insert a node after the target in children (recursive)
 */
function insertNodeAfterInChildren(
  parent: RouteNode,
  targetId: string,
  nodeToInsert: RouteNode
): boolean {
  if (!parent.children) return false;

  const childIndex = parent.children.findIndex((c) => c.id === targetId);
  if (childIndex !== -1) {
    parent.children.splice(childIndex + 1, 0, nodeToInsert);
    return true;
  }

  // Recursively check grandchildren
  for (const child of parent.children) {
    if (insertNodeAfterInChildren(child, targetId, nodeToInsert)) {
      return true;
    }
  }

  return false;
}

/**
 * Delete a node from the tree (recursive search)
 */
export function deleteNodeFromTree(routeTree: { roots: RouteNode[] }, nodeId: string): boolean {
  // Check roots
  const rootIndex = routeTree.roots.findIndex((r) => r.id === nodeId);
  if (rootIndex !== -1) {
    routeTree.roots.splice(rootIndex, 1);
    return true;
  }

  // Recursively check children
  for (const root of routeTree.roots) {
    if (deleteNodeFromChildren(root, nodeId)) {
      return true;
    }
  }

  return false;
}

/**
 * Delete a node from children (recursive)
 */
function deleteNodeFromChildren(parent: RouteNode, nodeId: string): boolean {
  if (!parent.children) return false;

  const childIndex = parent.children.findIndex((c) => c.id === nodeId);
  if (childIndex !== -1) {
    parent.children.splice(childIndex, 1);
    return true;
  }

  // Recursively check grandchildren
  for (const child of parent.children) {
    if (deleteNodeFromChildren(child, nodeId)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a node can be deleted
 */
export function canDeleteNode(routeTree: { roots: RouteNode[] }, node: RouteNode): boolean {
  if (!routeTree || !routeTree.roots || routeTree.roots.length === 0) return false;

  // If it's a root node, ensure it's not the last root
  const isRoot = routeTree.roots.some((r) => r.id === node.id);
  if (isRoot && routeTree.roots.length <= 1) {
    return false;
  }

  return true;
}
