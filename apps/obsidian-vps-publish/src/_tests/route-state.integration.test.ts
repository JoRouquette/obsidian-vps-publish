import type { RouteNode } from '@core-domain/entities/route-node';

import {
  areRouteTreesEqual,
  cancelRouteChanges,
  cloneRouteTree,
  initTempState,
  markAsChanged,
  saveRouteChanges,
} from '../lib/settings/utils/route-state.utils';
import {
  findNodeById,
  insertNodeAfter,
  removeNodeFromTree,
} from '../lib/settings/utils/route-tree.utils';

describe('Route State Management Integration Tests', () => {
  const createTestTree = (): { roots: RouteNode[] } => ({
    roots: [
      {
        id: 'root1',
        segment: '',
        ignoredCleanupRuleIds: [],
        children: [
          {
            id: 'child1',
            segment: 'blog',
            ignoredCleanupRuleIds: [],
          },
        ],
      },
    ],
  });

  describe('Temporary State Management', () => {
    it('should initialize temporary state from original tree', () => {
      const originalTree = createTestTree();
      const state = {
        tempRouteTree: null,
        hasUnsavedChanges: false,
      };

      initTempState(state, originalTree);

      expect(state.tempRouteTree).toBeDefined();
      expect(state.tempRouteTree).not.toBe(originalTree); // Should be a clone
      expect(areRouteTreesEqual(state.tempRouteTree!, originalTree)).toBe(true);
    });

    it('should not reinitialize if temporary state already exists', () => {
      const originalTree = createTestTree();
      const state = {
        tempRouteTree: null,
        hasUnsavedChanges: false,
      };

      initTempState(state, originalTree);
      const firstTemp = state.tempRouteTree;

      initTempState(state, originalTree);
      expect(state.tempRouteTree).toBe(firstTemp); // Should be the same instance
    });

    it('should mark state as changed', () => {
      const state = {
        tempRouteTree: createTestTree(),
        hasUnsavedChanges: false,
      };

      markAsChanged(state);
      expect(state.hasUnsavedChanges).toBe(true);
    });
  });

  describe('Save/Cancel Integration', () => {
    it('should save changes and reset state', () => {
      const originalTree = createTestTree();
      const state: {
        tempRouteTree: { roots: RouteNode[] } | null;
        hasUnsavedChanges: boolean;
      } = {
        tempRouteTree: null,
        hasUnsavedChanges: false,
      };

      // Initialize temp state
      initTempState(state, originalTree);

      // Make changes
      const newNode: RouteNode = {
        id: 'new-root',
        segment: 'api',
        ignoredCleanupRuleIds: [],
      };
      state.tempRouteTree!.roots.push(newNode);
      markAsChanged(state);

      // Save
      const savedTree = saveRouteChanges(state, originalTree);

      expect(savedTree.roots).toHaveLength(2);
      expect(savedTree.roots[1].id).toBe('new-root');
      expect(state.tempRouteTree).toBeNull();
      expect(state.hasUnsavedChanges).toBe(false);
    });

    it('should cancel changes and reset state without affecting original', () => {
      const originalTree = createTestTree();
      const state: {
        tempRouteTree: { roots: RouteNode[] } | null;
        hasUnsavedChanges: boolean;
      } = {
        tempRouteTree: null,
        hasUnsavedChanges: false,
      };

      // Initialize temp state
      initTempState(state, originalTree);

      // Make changes
      const newNode: RouteNode = {
        id: 'new-root',
        segment: 'api',
        ignoredCleanupRuleIds: [],
      };
      state.tempRouteTree!.roots.push(newNode);
      markAsChanged(state);

      // Cancel
      cancelRouteChanges(state);

      expect(state.tempRouteTree).toBeNull();
      expect(state.hasUnsavedChanges).toBe(false);
      expect(originalTree.roots).toHaveLength(1); // Original unchanged
    });

    it('should handle multiple edits before save', () => {
      const originalTree = createTestTree();
      const state: {
        tempRouteTree: { roots: RouteNode[] } | null;
        hasUnsavedChanges: boolean;
      } = {
        tempRouteTree: null,
        hasUnsavedChanges: false,
      };

      initTempState(state, originalTree);

      // Edit 1: Add new root
      state.tempRouteTree!.roots.push({
        id: 'new-root',
        segment: 'api',
        ignoredCleanupRuleIds: [],
      });
      markAsChanged(state);

      // Edit 2: Add child to existing root
      const root1 = findNodeById(state.tempRouteTree!, 'root1')!;
      if (!root1.children) root1.children = [];
      root1.children.push({
        id: 'new-child',
        segment: 'docs',
        ignoredCleanupRuleIds: [],
      });

      // Edit 3: Remove a node
      removeNodeFromTree(state.tempRouteTree!, 'child1');

      // Save all changes
      const savedTree = saveRouteChanges(state, originalTree);

      expect(savedTree.roots).toHaveLength(2);
      expect(savedTree.roots[0].children).toHaveLength(1);
      expect(savedTree.roots[0].children![0].id).toBe('new-child');
      expect(findNodeById(savedTree, 'child1')).toBeNull();
    });
  });

  describe('Drag & Drop with Temporary State', () => {
    it('should allow drag & drop operations in temporary state', () => {
      const originalTree = createTestTree();
      const state: {
        tempRouteTree: { roots: RouteNode[] } | null;
        hasUnsavedChanges: boolean;
      } = {
        tempRouteTree: null,
        hasUnsavedChanges: false,
      };

      initTempState(state, originalTree);

      // Add a second root
      state.tempRouteTree!.roots.push({
        id: 'root2',
        segment: 'api',
        ignoredCleanupRuleIds: [],
      });
      markAsChanged(state);

      // Drag root2 to be before root1
      const movedNode = removeNodeFromTree(state.tempRouteTree!, 'root2')!;
      insertNodeAfter(state.tempRouteTree!, 'root1', movedNode);

      // Verify order
      expect(state.tempRouteTree!.roots).toHaveLength(2);
      expect(state.tempRouteTree!.roots[0].id).toBe('root1');
      expect(state.tempRouteTree!.roots[1].id).toBe('root2');

      // Save
      const savedTree = saveRouteChanges(state, originalTree);
      expect(savedTree.roots[1].id).toBe('root2');

      // Original should be unchanged until save
      expect(originalTree.roots).toHaveLength(1);
    });

    it('should rollback drag & drop on cancel', () => {
      const originalTree = createTestTree();
      const state: {
        tempRouteTree: { roots: RouteNode[] } | null;
        hasUnsavedChanges: boolean;
      } = {
        tempRouteTree: null,
        hasUnsavedChanges: false,
      };

      initTempState(state, originalTree);

      // Add and move nodes
      state.tempRouteTree!.roots.push({
        id: 'root2',
        segment: 'api',
        ignoredCleanupRuleIds: [],
      });
      const movedNode = removeNodeFromTree(state.tempRouteTree!, 'child1')!;
      state.tempRouteTree!.roots.push(movedNode);
      markAsChanged(state);

      // Cancel
      cancelRouteChanges(state);

      // Re-initialize and verify original state is preserved
      initTempState(state, originalTree);
      expect(state.tempRouteTree!.roots).toHaveLength(1);
      expect(findNodeById(state.tempRouteTree!, 'child1')).toBeDefined();
      expect(findNodeById(state.tempRouteTree!, 'root2')).toBeNull();
    });
  });

  describe('Clone and Equality', () => {
    it('should create independent clones', () => {
      const originalTree = createTestTree();
      const clonedTree = cloneRouteTree(originalTree);

      // Modify clone
      clonedTree.roots.push({
        id: 'new-root',
        segment: 'api',
        ignoredCleanupRuleIds: [],
      });

      // Original should be unchanged
      expect(originalTree.roots).toHaveLength(1);
      expect(clonedTree.roots).toHaveLength(2);
    });

    it('should correctly compare equal trees', () => {
      const tree1 = createTestTree();
      const tree2 = cloneRouteTree(tree1);

      expect(areRouteTreesEqual(tree1, tree2)).toBe(true);
    });

    it('should correctly detect different trees', () => {
      const tree1 = createTestTree();
      const tree2 = cloneRouteTree(tree1);

      tree2.roots.push({
        id: 'new-root',
        segment: 'api',
        ignoredCleanupRuleIds: [],
      });

      expect(areRouteTreesEqual(tree1, tree2)).toBe(false);
    });

    it('should detect changes in nested structures', () => {
      const tree1 = createTestTree();
      const tree2 = cloneRouteTree(tree1);

      tree2.roots[0].children![0].segment = 'modified';

      expect(areRouteTreesEqual(tree1, tree2)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle saving without changes', () => {
      const originalTree = createTestTree();
      const state: {
        tempRouteTree: { roots: RouteNode[] } | null;
        hasUnsavedChanges: boolean;
      } = {
        tempRouteTree: null,
        hasUnsavedChanges: false,
      };

      initTempState(state, originalTree);

      // Save without changes (hasUnsavedChanges = false)
      const result = saveRouteChanges(state, originalTree);

      // Should return original tree since no changes
      expect(result).toBe(originalTree);
    });

    it('should handle cancel without initialization', () => {
      const state: {
        tempRouteTree: { roots: RouteNode[] } | null;
        hasUnsavedChanges: boolean;
      } = {
        tempRouteTree: null,
        hasUnsavedChanges: false,
      };

      // Should not throw
      expect(() => cancelRouteChanges(state)).not.toThrow();
      expect(state.tempRouteTree).toBeNull();
      expect(state.hasUnsavedChanges).toBe(false);
    });

    it('should handle empty tree', () => {
      const emptyTree = { roots: [] };
      const state: {
        tempRouteTree: { roots: RouteNode[] } | null;
        hasUnsavedChanges: boolean;
      } = {
        tempRouteTree: null,
        hasUnsavedChanges: false,
      };

      initTempState(state, emptyTree);
      const tempTree = state.tempRouteTree!;
      expect(tempTree.roots).toHaveLength(0);

      // Add a root
      tempTree.roots.push({
        id: 'first-root',
        segment: '',
        ignoredCleanupRuleIds: [],
      });
      markAsChanged(state);

      const savedTree = saveRouteChanges(state, emptyTree);
      expect(savedTree.roots).toHaveLength(1);
    });
  });
});
