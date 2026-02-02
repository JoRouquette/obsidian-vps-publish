import type { RouteNode } from '@core-domain/entities/route-node';

/**
 * Test helper functions for route state management
 */

interface TempRouteState {
  tempRouteTree: { roots: RouteNode[] } | null;
  hasUnsavedChanges: boolean;
}

/**
 * Clone a route tree for temporary editing
 */
export function cloneRouteTree(routeTree: { roots: RouteNode[] }): {
  roots: RouteNode[];
} {
  return JSON.parse(JSON.stringify(routeTree));
}

/**
 * Check if two route trees are equal (deep comparison)
 */
export function areRouteTreesEqual(
  tree1: { roots: RouteNode[] },
  tree2: { roots: RouteNode[] }
): boolean {
  return JSON.stringify(tree1) === JSON.stringify(tree2);
}

/**
 * Simulate the save operation
 */
export function saveRouteChanges(
  state: TempRouteState,
  originalTree: { roots: RouteNode[] }
): { roots: RouteNode[] } {
  if (!state.tempRouteTree || !state.hasUnsavedChanges) {
    return originalTree;
  }

  const savedTree = cloneRouteTree(state.tempRouteTree);
  state.tempRouteTree = null;
  state.hasUnsavedChanges = false;

  return savedTree;
}

/**
 * Simulate the cancel operation
 */
export function cancelRouteChanges(state: TempRouteState): void {
  state.tempRouteTree = null;
  state.hasUnsavedChanges = false;
}

/**
 * Initialize temporary state from original tree
 */
export function initTempState(state: TempRouteState, originalTree: { roots: RouteNode[] }): void {
  if (!state.tempRouteTree) {
    state.tempRouteTree = cloneRouteTree(originalTree);
  }
}

/**
 * Mark state as having unsaved changes
 */
export function markAsChanged(state: TempRouteState): void {
  state.hasUnsavedChanges = true;
}
