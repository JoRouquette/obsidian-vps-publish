# PHASE 6 Implementation Guide: Manifest Merge & Cleanup

## Overview

**STATUS**: Architecture designed, requires implementation in `staging-manager.ts`

The finalization phase must implement manifest merging to preserve unchanged pages from production while adding/updating only changed pages. This enables true inter-publication note deduplication.

## Current Behavior (Problematic)

`apps/node/src/infra/filesystem/staging-manager.ts` → `promoteSession()`:

```typescript
// Step 1: Clear production content (full replacement)
await this.clearRootExcept(this.contentRoot, ['.staging']);

// Step 3: Copy staged content to production (overwrites everything)
await this.copyDirContents(stagingContent, this.contentRoot);
```

**Problem**: This **deletes all existing production pages** even if they haven't changed, defeating deduplication.

## Required Implementation

### Location

Modify `promoteSession()` in `apps/node/src/infra/filesystem/staging-manager.ts`

### Algorithm (MUST follow this order)

```typescript
async promoteSession(sessionId: string): Promise<void> {
  const stagingContent = this.contentStagingPath(sessionId);
  const stagingAssets = this.assetsStagingPath(sessionId);

  await this.promotionMutex.runExclusive(async () => {
    // 1. Load BOTH manifests BEFORE any filesystem operations
    const productionManifest = await this.loadManifestFromProduction();
    const stagingManifest = await this.loadManifestFromStaging(sessionId);

    if (!stagingManifest) {
      throw new Error('Staging manifest not found');
    }

    // 2. Build final manifest with merged pages
    const stagingRoutes = new Set(stagingManifest.pages.map(p => p.route));

    // Keep production pages whose routes are NOT in staging (unchanged notes)
    const unchangedPages = productionManifest?.pages.filter(
      p => !stagingRoutes.has(p.route)
    ) ?? [];

    const finalManifest: Manifest = {
      ...stagingManifest,
      pages: [
        ...stagingManifest.pages,  // New/updated pages from staging
        ...unchangedPages           // Unchanged pages from production
      ],
      // Update pipelineSignature from staging (new pipeline state)
      pipelineSignature: stagingManifest.pipelineSignature,
    };

    // 3. Detect deleted pages (in production but not in final)
    const finalRoutes = new Set(finalManifest.pages.map(p => p.route));
    const deletedPages = productionManifest?.pages.filter(
      p => !finalRoutes.has(p.route)
    ) ?? [];

    // 4. Delete HTML files for deleted pages
    for (const page of deletedPages) {
      if (page.relativePath) {
        const htmlPath = path.join(this.contentRoot, page.relativePath);
        try {
          await fs.unlink(htmlPath);
          this.logger?.debug('Deleted HTML for removed page', {
            route: page.route,
            path: htmlPath,
          });
        } catch (err) {
          this.logger?.warn('Failed to delete HTML for removed page', {
            route: page.route,
            error: err,
          });
        }
      }
    }

    // 5. Copy staging content to production (only new/updated files)
    await this.copyDirContents(stagingContent, this.contentRoot);

    // 6. Save final manifest to production
    const productionManifestPort = new ManifestFileSystem(
      this.contentRoot,
      this.logger
    );
    await productionManifestPort.save(finalManifest);

    this.logger?.info('Manifest merged successfully', {
      sessionId,
      stagingPages: stagingManifest.pages.length,
      unchangedPages: unchangedPages.length,
      deletedPages: deletedPages.length,
      finalPages: finalManifest.pages.length,
    });

    // 7. Synchronize assets as before
    const referencedAssetPaths = new Set<string>(
      finalManifest.assets?.map(asset => asset.path) ?? []
    );
    await this.synchronizeAssets(stagingAssets, referencedAssetPaths);
  });

  await this.cleanupStaging(sessionId);
}
```

### Helper Method to Add

```typescript
/**
 * Load manifest from production content root
 */
private async loadManifestFromProduction(): Promise<Manifest | null> {
  try {
    const manifestPath = path.join(this.contentRoot, '_manifest.json');
    const raw = await fs.readFile(manifestPath, 'utf8');
    const parsed = JSON.parse(raw);

    // Deserialize dates + assets (same logic as manifest-file-system.ts)
    const pages = Array.isArray(parsed.pages)
      ? parsed.pages.map((p: any) => ({
          ...p,
          publishedAt: new Date(p.publishedAt ?? 0),
        }))
      : [];

    const assets = Array.isArray(parsed.assets)
      ? parsed.assets.map((a: any) => ({
          ...a,
          uploadedAt: new Date(a.uploadedAt ?? 0),
        }))
      : undefined;

    return {
      sessionId: parsed.sessionId ?? '',
      createdAt: new Date(parsed.createdAt ?? 0),
      lastUpdatedAt: new Date(parsed.lastUpdatedAt ?? 0),
      pages,
      folderDisplayNames: parsed.folderDisplayNames,
      canonicalMap: parsed.canonicalMap,
      assets,
      pipelineSignature: parsed.pipelineSignature,
    };
  } catch (err) {
    if ((err as any)?.code === 'ENOENT') {
      this.logger?.debug('No production manifest found (first publish)');
      return null;
    }
    throw err;
  }
}
```

## Critical Constraints

1. **Route is the unique identifier**: `page.route` (not `page.id`, not `page.vaultPath`)
2. **Load manifests BEFORE filesystem operations**: Production manifest must be read before any files are deleted
3. **Atomic operation**: The entire merge must happen inside `promotionMutex.runExclusive()`
4. **HTML deletion uses `relativePath`**: E.g., `/dir/note.html` derived from `page.relativePath`
5. **pipelineSignature preservation**: Final manifest MUST have staging's pipelineSignature

## Testing Strategy

### Unit Tests (apps/node/src/\_tests/)

```typescript
describe('StagingManager.promoteSession - Manifest Merge', () => {
  it('merges staging + production pages, preserves unchanged', async () => {
    // Setup: Production has [A, B, C]. Staging has [B_modified, D_new]
    // Expected: Final has [A, B_modified, C, D]
  });

  it('deletes HTML files for removed pages', async () => {
    // Setup: Production has [A, B]. Staging has [A_modified]
    // Expected: B.html deleted, A.html updated
  });

  it('handles first publish (no production manifest)', async () => {
    // Expected: Final manifest = staging manifest
  });

  it('updates pipelineSignature from staging', async () => {
    // Expected: finalManifest.pipelineSignature === stagingManifest.pipelineSignature
  });
});
```

### Integration Tests

Use existing E2E framework in `apps/node/src/_tests/` to simulate:

1. Publish 10 notes → manifest has 10 pages
2. Modify 1 note, publish → manifest still has 10 pages (9 unchanged + 1 updated)
3. Delete 2 notes from vault, publish → manifest has 8 pages, 2 HTML files deleted

## Dependencies

- `ManifestFileSystem` (already exists, handles serialization)
- `Mutex` (already used in `promoteSession`)
- `fs` promises API (already imported)

## Timeline Estimate

- Implementation: 2-3 hours
- Unit tests: 1-2 hours
- Integration tests: 2-3 hours
- **Total: ~6-8 hours**

## Rollback Strategy

If issues arise, the current behavior (full replacement) can be temporarily restored by:

1. Commenting out merge logic
2. Reverting to original `clearRootExcept()` + `copyDirContents()` sequence

---

**STATUS**: Ready for implementation. All prerequisite phases (1-5) are completed and functional.
