import type { RouteNode } from '@core-domain/entities/route-node';

import {
  canDeleteNode,
  deleteNodeFromTree,
  findNodeById,
  findParentNode,
  insertNodeAfter,
  insertNodeBefore,
  isDescendant,
  removeNodeFromTree,
} from '../lib/settings/utils/route-tree.utils';

describe('Route Tree Utilities', () => {
  // Helper to create a test route tree
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
            children: [
              {
                id: 'grandchild1',
                segment: 'posts',
                ignoredCleanupRuleIds: [],
              },
            ],
          },
          {
            id: 'child2',
            segment: 'docs',
            ignoredCleanupRuleIds: [],
          },
        ],
      },
      {
        id: 'root2',
        segment: 'api',
        ignoredCleanupRuleIds: [],
      },
    ],
  });

  describe('findNodeById', () => {
    it('should find a root node', () => {
      const tree = createTestTree();
      const node = findNodeById(tree, 'root1');
      expect(node).toBeDefined();
      expect(node?.id).toBe('root1');
    });

    it('should find a child node', () => {
      const tree = createTestTree();
      const node = findNodeById(tree, 'child1');
      expect(node).toBeDefined();
      expect(node?.id).toBe('child1');
      expect(node?.segment).toBe('blog');
    });

    it('should find a grandchild node', () => {
      const tree = createTestTree();
      const node = findNodeById(tree, 'grandchild1');
      expect(node).toBeDefined();
      expect(node?.id).toBe('grandchild1');
      expect(node?.segment).toBe('posts');
    });

    it('should return null for non-existent node', () => {
      const tree = createTestTree();
      const node = findNodeById(tree, 'non-existent');
      expect(node).toBeNull();
    });

    it('should handle empty tree', () => {
      const tree = { roots: [] };
      const node = findNodeById(tree, 'any');
      expect(node).toBeNull();
    });
  });

  describe('findParentNode', () => {
    it('should return null for root nodes', () => {
      const tree = createTestTree();
      const parent = findParentNode(tree, 'root1');
      expect(parent).toBeNull();
    });

    it('should find parent of a direct child', () => {
      const tree = createTestTree();
      const parent = findParentNode(tree, 'child1');
      expect(parent).toBeDefined();
      expect(parent?.id).toBe('root1');
    });

    it('should find parent of a grandchild', () => {
      const tree = createTestTree();
      const parent = findParentNode(tree, 'grandchild1');
      expect(parent).toBeDefined();
      expect(parent?.id).toBe('child1');
    });

    it('should return null for non-existent node', () => {
      const tree = createTestTree();
      const parent = findParentNode(tree, 'non-existent');
      expect(parent).toBeNull();
    });
  });

  describe('isDescendant', () => {
    it('should return true for the same node', () => {
      const tree = createTestTree();
      const node = findNodeById(tree, 'root1')!;
      expect(isDescendant(node, 'root1')).toBe(true);
    });

    it('should return true for direct child', () => {
      const tree = createTestTree();
      const node = findNodeById(tree, 'root1')!;
      expect(isDescendant(node, 'child1')).toBe(true);
    });

    it('should return true for grandchild', () => {
      const tree = createTestTree();
      const node = findNodeById(tree, 'root1')!;
      expect(isDescendant(node, 'grandchild1')).toBe(true);
    });

    it('should return false for non-descendant', () => {
      const tree = createTestTree();
      const node = findNodeById(tree, 'child1')!;
      expect(isDescendant(node, 'root2')).toBe(false);
    });

    it('should return false for node without children', () => {
      const tree = createTestTree();
      const node = findNodeById(tree, 'root2')!;
      expect(isDescendant(node, 'child1')).toBe(false);
    });
  });

  describe('removeNodeFromTree', () => {
    it('should remove a root node', () => {
      const tree = createTestTree();
      const removed = removeNodeFromTree(tree, 'root2');
      expect(removed).toBeDefined();
      expect(removed?.id).toBe('root2');
      expect(tree.roots).toHaveLength(1);
      expect(tree.roots[0].id).toBe('root1');
    });

    it('should remove a child node', () => {
      const tree = createTestTree();
      const removed = removeNodeFromTree(tree, 'child2');
      expect(removed).toBeDefined();
      expect(removed?.id).toBe('child2');
      const root = findNodeById(tree, 'root1')!;
      expect(root.children).toHaveLength(1);
      expect(root.children![0].id).toBe('child1');
    });

    it('should remove a grandchild node', () => {
      const tree = createTestTree();
      const removed = removeNodeFromTree(tree, 'grandchild1');
      expect(removed).toBeDefined();
      expect(removed?.id).toBe('grandchild1');
      const child = findNodeById(tree, 'child1')!;
      expect(child.children).toHaveLength(0);
    });

    it('should return null for non-existent node', () => {
      const tree = createTestTree();
      const removed = removeNodeFromTree(tree, 'non-existent');
      expect(removed).toBeNull();
    });

    it('should preserve node structure when removed', () => {
      const tree = createTestTree();
      const removed = removeNodeFromTree(tree, 'child1');
      expect(removed).toBeDefined();
      expect(removed?.children).toHaveLength(1);
      expect(removed?.children![0].id).toBe('grandchild1');
    });
  });

  describe('insertNodeBefore', () => {
    it('should insert before a root node', () => {
      const tree = createTestTree();
      const newNode: RouteNode = {
        id: 'new-root',
        segment: 'new',
        ignoredCleanupRuleIds: [],
      };
      const success = insertNodeBefore(tree, 'root2', newNode);
      expect(success).toBe(true);
      expect(tree.roots).toHaveLength(3);
      expect(tree.roots[1].id).toBe('new-root');
      expect(tree.roots[2].id).toBe('root2');
    });

    it('should insert before a child node', () => {
      const tree = createTestTree();
      const newNode: RouteNode = {
        id: 'new-child',
        segment: 'new',
        ignoredCleanupRuleIds: [],
      };
      const success = insertNodeBefore(tree, 'child2', newNode);
      expect(success).toBe(true);
      const root = findNodeById(tree, 'root1')!;
      expect(root.children).toHaveLength(3);
      expect(root.children![1].id).toBe('new-child');
      expect(root.children![2].id).toBe('child2');
    });

    it('should return false for non-existent target', () => {
      const tree = createTestTree();
      const newNode: RouteNode = {
        id: 'new',
        segment: 'new',
        ignoredCleanupRuleIds: [],
      };
      const success = insertNodeBefore(tree, 'non-existent', newNode);
      expect(success).toBe(false);
    });
  });

  describe('insertNodeAfter', () => {
    it('should insert after a root node', () => {
      const tree = createTestTree();
      const newNode: RouteNode = {
        id: 'new-root',
        segment: 'new',
        ignoredCleanupRuleIds: [],
      };
      const success = insertNodeAfter(tree, 'root1', newNode);
      expect(success).toBe(true);
      expect(tree.roots).toHaveLength(3);
      expect(tree.roots[1].id).toBe('new-root');
      expect(tree.roots[2].id).toBe('root2');
    });

    it('should insert after a child node', () => {
      const tree = createTestTree();
      const newNode: RouteNode = {
        id: 'new-child',
        segment: 'new',
        ignoredCleanupRuleIds: [],
      };
      const success = insertNodeAfter(tree, 'child1', newNode);
      expect(success).toBe(true);
      const root = findNodeById(tree, 'root1')!;
      expect(root.children).toHaveLength(3);
      expect(root.children![1].id).toBe('new-child');
      expect(root.children![2].id).toBe('child2');
    });

    it('should insert at the end when target is last', () => {
      const tree = createTestTree();
      const newNode: RouteNode = {
        id: 'new-child',
        segment: 'new',
        ignoredCleanupRuleIds: [],
      };
      const success = insertNodeAfter(tree, 'child2', newNode);
      expect(success).toBe(true);
      const root = findNodeById(tree, 'root1')!;
      expect(root.children).toHaveLength(3);
      expect(root.children![2].id).toBe('new-child');
    });
  });

  describe('deleteNodeFromTree', () => {
    it('should delete a root node', () => {
      const tree = createTestTree();
      const success = deleteNodeFromTree(tree, 'root2');
      expect(success).toBe(true);
      expect(tree.roots).toHaveLength(1);
      expect(findNodeById(tree, 'root2')).toBeNull();
    });

    it('should delete a child node', () => {
      const tree = createTestTree();
      const success = deleteNodeFromTree(tree, 'child1');
      expect(success).toBe(true);
      const root = findNodeById(tree, 'root1')!;
      expect(root.children).toHaveLength(1);
      expect(findNodeById(tree, 'child1')).toBeNull();
    });

    it('should return false for non-existent node', () => {
      const tree = createTestTree();
      const success = deleteNodeFromTree(tree, 'non-existent');
      expect(success).toBe(false);
    });
  });

  describe('canDeleteNode', () => {
    it('should return false for the last root node', () => {
      const tree = { roots: [{ id: 'root1', segment: '', ignoredCleanupRuleIds: [] }] };
      const node = tree.roots[0];
      expect(canDeleteNode(tree, node)).toBe(false);
    });

    it('should return true for a root node when there are multiple roots', () => {
      const tree = createTestTree();
      const node = findNodeById(tree, 'root2')!;
      expect(canDeleteNode(tree, node)).toBe(true);
    });

    it('should return true for any child node', () => {
      const tree = createTestTree();
      const node = findNodeById(tree, 'child1')!;
      expect(canDeleteNode(tree, node)).toBe(true);
    });

    it('should return false for empty tree', () => {
      const tree = { roots: [] };
      const node: RouteNode = { id: 'test', segment: '', ignoredCleanupRuleIds: [] };
      expect(canDeleteNode(tree, node)).toBe(false);
    });
  });

  describe('Drag & Drop Integration', () => {
    it('should move a child from one parent to another', () => {
      const tree = createTestTree();

      // Remove child2 from root1
      const movedNode = removeNodeFromTree(tree, 'child2')!;
      expect(movedNode).toBeDefined();

      // Add it as a child of root2
      const root2 = findNodeById(tree, 'root2')!;
      if (!root2.children) root2.children = [];
      root2.children.push(movedNode);

      // Verify
      expect(root2.children).toHaveLength(1);
      expect(root2.children[0].id).toBe('child2');
      const root1 = findNodeById(tree, 'root1')!;
      expect(root1.children).toHaveLength(1);
      expect(root1.children![0].id).toBe('child1');
    });

    it('should prevent moving a parent into its own child', () => {
      const tree = createTestTree();
      const parent = findNodeById(tree, 'root1')!;
      const child = findNodeById(tree, 'child1')!;

      // Check if parent is descendant of child (should be false)
      expect(isDescendant(child, 'root1')).toBe(false);
      // Check if child is descendant of parent (should be true)
      expect(isDescendant(parent, 'child1')).toBe(true);
    });

    it('should reorder siblings using remove and insert', () => {
      const tree = createTestTree();

      // Move child2 before child1
      const movedNode = removeNodeFromTree(tree, 'child2')!;
      const success = insertNodeBefore(tree, 'child1', movedNode);

      expect(success).toBe(true);
      const root = findNodeById(tree, 'root1')!;
      expect(root.children).toHaveLength(2);
      expect(root.children![0].id).toBe('child2');
      expect(root.children![1].id).toBe('child1');
    });

    it('should move a root node to become a child', () => {
      const tree = createTestTree();

      // Remove root2
      const movedNode = removeNodeFromTree(tree, 'root2')!;
      expect(movedNode).toBeDefined();

      // Add it as a child of root1
      const root1 = findNodeById(tree, 'root1')!;
      if (!root1.children) root1.children = [];
      root1.children.push(movedNode);

      // Verify
      expect(tree.roots).toHaveLength(1);
      expect(tree.roots[0].id).toBe('root1');
      expect(root1.children).toHaveLength(3);
      expect(root1.children![2].id).toBe('root2');
    });

    it('should move a child to become a root', () => {
      const tree = createTestTree();

      // Remove child1 from root1
      const movedNode = removeNodeFromTree(tree, 'child1')!;
      expect(movedNode).toBeDefined();
      expect(movedNode.children).toHaveLength(1); // Preserve grandchild

      // Add it as a root
      tree.roots.push(movedNode);

      // Verify
      expect(tree.roots).toHaveLength(3);
      expect(tree.roots[2].id).toBe('child1');
      const root1 = findNodeById(tree, 'root1')!;
      expect(root1.children).toHaveLength(1);
      expect(root1.children![0].id).toBe('child2');
    });
  });

  describe('Edge Cases', () => {
    it('should handle node with no children', () => {
      const tree = { roots: [{ id: 'root1', segment: '', ignoredCleanupRuleIds: [] }] };
      const parent = findParentNode(tree, 'root1');
      expect(parent).toBeNull();
    });

    it('should handle deeply nested tree', () => {
      const tree: { roots: RouteNode[] } = {
        roots: [
          {
            id: 'root',
            segment: '',
            ignoredCleanupRuleIds: [],
            children: [
              {
                id: 'level1',
                segment: 'l1',
                ignoredCleanupRuleIds: [],
                children: [
                  {
                    id: 'level2',
                    segment: 'l2',
                    ignoredCleanupRuleIds: [],
                    children: [
                      {
                        id: 'level3',
                        segment: 'l3',
                        ignoredCleanupRuleIds: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      const deepNode = findNodeById(tree, 'level3');
      expect(deepNode).toBeDefined();
      expect(deepNode?.segment).toBe('l3');

      const parent = findParentNode(tree, 'level3');
      expect(parent).toBeDefined();
      expect(parent?.id).toBe('level2');

      const root = findNodeById(tree, 'root')!;
      expect(isDescendant(root, 'level3')).toBe(true);
    });

    it('should handle multiple children with same segment', () => {
      const tree: { roots: RouteNode[] } = {
        roots: [
          {
            id: 'root',
            segment: '',
            ignoredCleanupRuleIds: [],
            children: [
              { id: 'child1', segment: 'blog', ignoredCleanupRuleIds: [] },
              { id: 'child2', segment: 'blog', ignoredCleanupRuleIds: [] },
            ],
          },
        ],
      };

      const node1 = findNodeById(tree, 'child1');
      const node2 = findNodeById(tree, 'child2');
      expect(node1).toBeDefined();
      expect(node2).toBeDefined();
      expect(node1?.id).not.toBe(node2?.id);
    });
  });
});
