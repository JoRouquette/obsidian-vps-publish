import {
  getNodeConflicts,
  hasNodeConflicts,
  validateRouteTree,
} from '../../entities/route-node-validation';
import type { RouteNode, RouteTreeConfig } from '../../entities/route-node';

describe('Route Validation', () => {
  describe('validateRouteTree', () => {
    it('should return valid for a simple valid tree', () => {
      const tree: RouteTreeConfig = {
        roots: [
          { id: '1', segment: 'docs' },
          { id: '2', segment: 'blog' },
        ],
      };

      const result = validateRouteTree(tree);

      expect(result.valid).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should return valid for nested routes without conflicts', () => {
      const tree: RouteTreeConfig = {
        roots: [
          {
            id: '1',
            segment: 'docs',
            children: [
              { id: '1-1', segment: 'api' },
              { id: '1-2', segment: 'guide' },
            ],
          },
          { id: '2', segment: 'blog' },
        ],
      };

      const result = validateRouteTree(tree);

      expect(result.valid).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should detect duplicate segments at same level', () => {
      const tree: RouteTreeConfig = {
        roots: [
          { id: '1', segment: 'docs' },
          { id: '2', segment: 'docs' }, // Duplicate!
          { id: '3', segment: 'blog' },
        ],
      };

      const result = validateRouteTree(tree);

      expect(result.valid).toBe(false);
      // Should have duplicate-segment AND duplicate-path
      expect(result.conflicts.length).toBeGreaterThanOrEqual(1);
      expect(result.conflicts.some((c) => c.type === 'duplicate-segment')).toBe(true);

      const segmentConflict = result.conflicts.find((c) => c.type === 'duplicate-segment');
      expect(segmentConflict?.message).toContain('Duplicate segment "docs"');
      expect(segmentConflict?.conflictingNodes).toHaveLength(2);
      expect(segmentConflict?.conflictingNodes.map((n) => n.id)).toEqual(
        expect.arrayContaining(['1', '2'])
      );
    });

    it('should detect duplicate segments in nested children', () => {
      const tree: RouteTreeConfig = {
        roots: [
          {
            id: '1',
            segment: 'docs',
            children: [
              { id: '1-1', segment: 'api' },
              { id: '1-2', segment: 'api' }, // Duplicate!
            ],
          },
        ],
      };

      const result = validateRouteTree(tree);

      expect(result.valid).toBe(false);
      // Should have both duplicate-segment and duplicate-path
      expect(result.conflicts.length).toBeGreaterThanOrEqual(1);
      expect(result.conflicts.some((c) => c.type === 'duplicate-segment')).toBe(true);
      expect(result.conflicts.some((c) => c.path === '/docs/api')).toBe(true);
    });

    it('should detect duplicate full paths from different branches', () => {
      const tree: RouteTreeConfig = {
        roots: [
          {
            id: '1',
            segment: 'docs',
            children: [{ id: '1-1', segment: 'api' }],
          },
          {
            id: '2',
            segment: 'docs',
            children: [{ id: '2-1', segment: 'api' }],
          },
        ],
      };

      const result = validateRouteTree(tree);

      expect(result.valid).toBe(false);
      // Should have both duplicate-segment (at root) AND duplicate-path (/docs/api)
      expect(result.conflicts.length).toBeGreaterThanOrEqual(2);
      expect(result.conflicts.some((c) => c.type === 'duplicate-segment')).toBe(true);
      expect(result.conflicts.some((c) => c.type === 'duplicate-path')).toBe(true);
    });

    it('should detect empty segments', () => {
      const tree: RouteTreeConfig = {
        roots: [
          { id: '1', segment: 'docs' },
          { id: '2', segment: '' }, // Empty at root level
          { id: '3', segment: '  ' }, // Whitespace only (normalizes to empty)
        ],
      };

      const result = validateRouteTree(tree);

      expect(result.valid).toBe(false);
      // Two nodes with empty segments = duplicate segment conflict
      expect(result.conflicts.length).toBeGreaterThanOrEqual(1);
      expect(
        result.conflicts.some((c) => c.type === 'duplicate-segment' || c.type === 'duplicate-path')
      ).toBe(true);
    });

    it('should detect empty segments in nested nodes', () => {
      const tree: RouteTreeConfig = {
        roots: [
          {
            id: '1',
            segment: 'docs',
            children: [
              { id: '1-1', segment: 'api' },
              { id: '1-2', segment: '' }, // Empty!
            ],
          },
        ],
      };

      const result = validateRouteTree(tree);

      expect(result.valid).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('empty-segment');
    });

    it('should detect multiple root nodes with empty segment', () => {
      const tree: RouteTreeConfig = {
        roots: [
          { id: '1', segment: '' }, // Root node
          { id: '2', segment: '' }, // Another root with empty segment - duplicate!
        ],
      };

      const result = validateRouteTree(tree);

      // Multiple roots with same (empty) segment should conflict
      expect(result.valid).toBe(false);
      expect(result.conflicts.length).toBeGreaterThanOrEqual(1);
      expect(
        result.conflicts.some((c) => c.type === 'duplicate-segment' || c.type === 'duplicate-path')
      ).toBe(true);
    });

    it('should handle complex nested conflicts', () => {
      const tree: RouteTreeConfig = {
        roots: [
          {
            id: '1',
            segment: 'docs',
            children: [
              {
                id: '1-1',
                segment: 'guide',
                children: [
                  { id: '1-1-1', segment: 'intro' },
                  { id: '1-1-2', segment: 'intro' }, // Duplicate!
                ],
              },
            ],
          },
        ],
      };

      const result = validateRouteTree(tree);

      expect(result.valid).toBe(false);
      // Should have both duplicate-segment and duplicate-path
      expect(result.conflicts.length).toBeGreaterThanOrEqual(1);
      expect(result.conflicts.some((c) => c.path === '/docs/guide/intro')).toBe(true);
    });

    it('should normalize paths with multiple slashes', () => {
      const tree: RouteTreeConfig = {
        roots: [
          { id: '1', segment: 'docs' },
          { id: '2', segment: '/docs' }, // Leading slash
        ],
      };

      const result = validateRouteTree(tree);

      // Paths should normalize to /docs and ///docs -> /docs
      expect(result.valid).toBe(false);
      expect(result.conflicts.some((c) => c.type === 'duplicate-segment')).toBe(true);
    });
  });

  describe('getNodeConflicts', () => {
    it('should return conflicts for a specific node', () => {
      const tree: RouteTreeConfig = {
        roots: [
          { id: '1', segment: 'docs' },
          { id: '2', segment: 'docs' },
        ],
      };

      const conflicts = getNodeConflicts(tree, '1');

      // Should return both duplicate-segment and duplicate-path
      expect(conflicts.length).toBeGreaterThanOrEqual(1);
      expect(conflicts.every((c) => c.conflictingNodes.some((n) => n.id === '1'))).toBe(true);
    });

    it('should return empty array for node without conflicts', () => {
      const tree: RouteTreeConfig = {
        roots: [
          { id: '1', segment: 'docs' },
          { id: '2', segment: 'blog' },
        ],
      };

      const conflicts = getNodeConflicts(tree, '1');

      expect(conflicts).toHaveLength(0);
    });

    it('should return all conflicts involving the node', () => {
      const tree: RouteTreeConfig = {
        roots: [
          { id: '1', segment: 'docs' },
          { id: '2', segment: 'docs' }, // Duplicate with 1
          { id: '3', segment: 'docs' }, // Another duplicate
        ],
      };

      const conflicts = getNodeConflicts(tree, '2');

      // Should have both duplicate-segment and duplicate-path
      expect(conflicts.length).toBeGreaterThanOrEqual(1);

      // At least one conflict should have all 3 nodes
      const hasAllNodes = conflicts.some((c) => c.conflictingNodes.length === 3);
      expect(hasAllNodes).toBe(true);
    });
  });

  describe('hasNodeConflicts', () => {
    it('should return true if node has conflicts', () => {
      const tree: RouteTreeConfig = {
        roots: [
          { id: '1', segment: 'docs' },
          { id: '2', segment: 'docs' },
        ],
      };

      expect(hasNodeConflicts(tree, '1')).toBe(true);
      expect(hasNodeConflicts(tree, '2')).toBe(true);
    });

    it('should return false if node has no conflicts', () => {
      const tree: RouteTreeConfig = {
        roots: [
          { id: '1', segment: 'docs' },
          { id: '2', segment: 'blog' },
        ],
      };

      expect(hasNodeConflicts(tree, '1')).toBe(false);
      expect(hasNodeConflicts(tree, '2')).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty tree', () => {
      const tree: RouteTreeConfig = { roots: [] };

      const result = validateRouteTree(tree);

      expect(result.valid).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should handle tree with undefined roots', () => {
      const tree: RouteTreeConfig = { roots: undefined as any };

      const result = validateRouteTree(tree);

      expect(result.valid).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should handle nodes with special characters', () => {
      const tree: RouteTreeConfig = {
        roots: [
          { id: '1', segment: 'docs-api' },
          { id: '2', segment: 'docs_guide' },
          { id: '3', segment: 'blog.2024' },
        ],
      };

      const result = validateRouteTree(tree);

      expect(result.valid).toBe(true);
    });

    it('should handle very deep nesting', () => {
      const tree: RouteTreeConfig = {
        roots: [
          {
            id: '1',
            segment: 'level1',
            children: [
              {
                id: '2',
                segment: 'level2',
                children: [
                  {
                    id: '3',
                    segment: 'level3',
                    children: [
                      {
                        id: '4',
                        segment: 'level4',
                        children: [{ id: '5', segment: 'level5' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = validateRouteTree(tree);

      expect(result.valid).toBe(true);
    });
  });
});
