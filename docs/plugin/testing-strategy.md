# Testing Strategy for Routes Management

## Overview

This document describes the comprehensive testing strategy for the routes management system with temporary state and drag & drop functionality.

## Test Structure

### 1. Unit Tests (`route-tree.utils.test.ts`)

**Purpose**: Test individual utility functions in isolation.

**Coverage** (142 tests):

#### Node Finding Operations

- `findNodeById`: Locate nodes at any depth
- `findParentNode`: Find parent of a given node
- Edge cases: non-existent nodes, null/undefined inputs

#### Tree Validation

- `isDescendant`: Verify parent-child relationships
- Prevent circular references
- Handle complex nested structures

#### Node Manipulation

- `removeNodeFromTree`: Delete nodes and update structure
- `insertNodeBefore`: Insert with correct ordering
- `insertNodeAfter`: Append nodes maintaining structure
- `deleteNodeFromTree`: Safe deletion with validation

#### Drag & Drop Scenarios

- Move nodes between different levels
- Reorder siblings
- Change parent relationships
- Prevent invalid moves (parent to its own descendant)

#### Edge Cases

- Empty trees
- Single node trees
- Deep nesting (5+ levels)
- Large trees (100+ nodes)

### 2. Integration Tests (`route-state.integration.test.ts`)

**Purpose**: Test the complete save/cancel workflow with temporary state management.

**Coverage** (15 tests):

#### Save/Cancel Workflow

- Initialize temporary state from original tree
- Make multiple edits in temp state
- Save changes and verify persistence
- Cancel changes and verify rollback
- Original tree remains unchanged until save

#### State Management

- `initTempState`: Clone tree for editing
- `markAsChanged`: Flag unsaved modifications
- `saveRouteChanges`: Commit temp state to original
- `cancelRouteChanges`: Discard temp state

#### Multi-Edit Scenarios

- Sequential edits (add, modify, delete)
- Consecutive save operations
- Complex tree transformations

#### Drag & Drop with State

- Drag operations in temporary state
- Rollback drag operations on cancel
- Save drag operations to original tree

#### Tree Comparison

- `cloneRouteTree`: Deep clone without side effects
- `areRouteTreesEqual`: Deep equality check
- Detect nested differences

#### Edge Cases

- Save without changes (no-op)
- Cancel without initialization
- Empty tree handling
- Null/undefined state validation

## Test Data

### Sample Tree Structure

```typescript
{
  roots: [
    {
      id: 'root1',
      segment: '',
      ignoredCleanupRuleIds: [],
      children: [
        {
          id: 'child1',
          segment: 'docs',
          ignoredCleanupRuleIds: [],
          children: [
            {
              id: 'grandchild1',
              segment: 'api',
              ignoredCleanupRuleIds: [],
            },
          ],
        },
      ],
    },
  ];
}
```

## Running Tests

```bash
# All plugin tests
npm run test obsidian-vps-publish

# Specific test file
npx nx test obsidian-vps-publish --testPathPattern="route-tree.utils.test"
npx nx test obsidian-vps-publish --testPathPattern="route-state.integration.test"

# With coverage
npx nx test obsidian-vps-publish --coverage
```

## Test Conventions

### Naming

- Unit tests: `<module>.test.ts`
- Integration tests: `<feature>.integration.test.ts`
- Located in `apps/obsidian-vps-publish/src/_tests/`

### Structure

```typescript
describe('Feature', () => {
  describe('Specific Operation', () => {
    it('should behave as expected', () => {
      // Arrange
      const input = createTestData();

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### Type Safety

- Explicit type annotations for state objects in tests
- Use typed interfaces instead of non-null assertions
- Avoid `any` types

Example:

```typescript
const state: {
  tempRouteTree: { roots: RouteNode[] } | null;
  hasUnsavedChanges: boolean;
} = {
  tempRouteTree: null,
  hasUnsavedChanges: false,
};
```

## Coverage Goals

- **Unit tests**: 100% coverage of utility functions
- **Integration tests**: All user workflows covered
- **Edge cases**: Null, undefined, empty, large datasets
- **Error scenarios**: Invalid operations, constraint violations

## Continuous Integration

Tests run automatically on:

- Every commit (via Husky pre-commit hook)
- Pull request validation
- Before release (`npm run build` includes test step)

## Related Documentation

- [Routes Settings UI](./folders-settings-ui.md)
- [Drag & Drop Implementation](./folders-settings-ui-implementation.md)
- [Performance Analysis](./performance-analysis.md)
