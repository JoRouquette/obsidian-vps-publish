# Asset Deduplication & Lifecycle Management

## Purpose

The asset deduplication system prevents redundant uploads and ensures efficient storage management through:

1. **SHA256-based deduplication** - Identical assets are uploaded only once, regardless of filename or location
2. **Selective promotion** - Staging-to-production synchronization preserves referenced assets and removes obsolete ones
3. **Automatic cleanup** - Orphaned assets are automatically removed during session finalization

This provides:

- **Storage efficiency** - Eliminates duplicate files based on content hash
- **Bandwidth optimization** - Skips re-upload of unchanged assets
- **Automatic garbage collection** - Removes unreferenced assets without manual intervention
- **Data integrity** - Manifest-driven synchronization ensures consistency between metadata and files

## When to Use

This system is **always active** in production when the manifest storage is configured (default behavior).

**Benefits are most visible when:**

- Publishing incremental updates (unchanged assets are skipped)
- Reusing common assets across multiple pages (logos, diagrams, icons)
- Publishing large vaults with many binary files
- Long-running publications with frequent updates

**Implementation note:** The plugin (Obsidian client) can also compute hashes client-side and skip uploads before sending data to the API (not yet implemented but architecture supports it).

## Key Concepts

### Architecture (Clean Architecture)

The deduplication system follows **Clean Architecture** with clear separation of concerns:

**Domain Layer** (`libs/core-domain`):

- **`ManifestAsset`** - Asset metadata with hash for deduplication
  ```typescript
  interface ManifestAsset {
    path: string; // Relative path (e.g., "_assets/image.png")
    hash: string; // SHA256 hash (64 hex chars)
    size: number; // Size in bytes
    mimeType: string; // Detected MIME type
    uploadedAt: Date; // Upload timestamp
  }
  ```
- **`AssetHashPort`** - Interface for hash computation (dependency inversion)
  ```typescript
  interface AssetHashPort {
    computeHash(buffer: Buffer | Uint8Array): Promise<string>;
  }
  ```

**Application Layer** (`libs/core-application`):

- **`UploadAssetsHandler`** - Deduplication logic during asset upload
  - Loads existing manifest from production
  - Builds hash-to-asset Map for O(1) lookup
  - For each asset: computes hash → checks if exists → skips upload or saves
  - Updates staging manifest with ALL referenced assets (new + reused)
- **`UploadAssetsResult`** - Extended with deduplication statistics
  ```typescript
  interface UploadAssetsResult {
    sessionId: string;
    published: number;
    skipped?: number; // Count of deduplicated assets
    skippedAssets?: string[]; // List of skipped asset paths
    errors?: AssetError[];
  }
  ```

**Infrastructure Layer** (`apps/node/src/infra`):

- **`AssetHashService`** - SHA256 implementation using Node.js `crypto`
- **`StagingManager`** - Selective promotion with manifest-driven sync

### Deduplication Workflow

```
1. Client uploads asset batch
   ↓
2. UploadAssetsHandler receives assets
   ↓
3. Load existing manifest from production
   ↓
4. For each asset:
   a. Compute SHA256 hash
   b. Check if hash exists in manifest
   c. If exists → Skip upload, add existing asset ref to staging manifest
   d. If new → Upload to staging, add new asset to staging manifest
   ↓
5. Save staging manifest with ALL assets (new + reused)
   ↓
6. Return statistics (published, skipped)
```

### Selective Promotion (Session Finalization)

During `POST /api/session/:sessionId/finish`, the backend:

1. **Reads staging manifest** - Gets list of all referenced assets
2. **Synchronizes production assets**:
   - **Copy** new assets from staging → production
   - **Keep** existing assets referenced in manifest
   - **Delete** assets in production NOT in manifest (cleanup)
3. **Promotes content** - Copies rendered HTML + manifest to production
4. **Cleans up** - Removes staging directories

```
Production Assets Before:    Manifest References:    Production Assets After:
- asset1.png (hash: abc123)   - asset1.png (abc123)   - asset1.png (kept)
- asset2.jpg (hash: def456)   - asset3.webp (ghi789)  - asset3.webp (new)
- obsolete.gif (hash: old999)                         (obsolete.gif deleted)
```

**Key insight:** The manifest is the source of truth. Any asset NOT referenced in the manifest is considered obsolete and removed.

## Configuration

### Backend Configuration

No additional environment variables required. Deduplication is enabled by default when manifest storage is configured.

**Optional tuning:**

If using custom storage implementations, ensure manifest includes `assets` field:

```typescript
// In custom ManifestPort implementation
async save(manifest: Manifest): Promise<void> {
  // Ensure assets array is persisted
  const serialized = JSON.stringify({
    ...manifest,
    assets: manifest.assets || [], // Preserve assets array
  });
  await fs.writeFile(this.path, serialized);
}
```

### Plugin Configuration (Future)

When plugin-side deduplication is implemented, configuration will be added to:

- `apps/obsidian-vps-publish/src/settings.ts` - Enable/disable client-side hash computation
- Trade-off: CPU overhead (hash computation) vs bandwidth savings (skipped uploads)

## Usage

### API Usage (Automatic)

Deduplication happens automatically during asset upload. No changes required in API calls.

**Request:**

```http
POST /api/session/:sessionId/assets/upload
x-api-key: your-api-key
Content-Type: application/json

{
  "assets": [
    {
      "fileName": "logo.png",
      "relativePath": "_assets/logo.png",
      "vaultPath": "vault/attachments/logo.png",
      "contentBase64": "iVBORw0KG...",
      "mimeType": "image/png"
    }
  ]
}
```

**Response (with deduplication):**

```json
{
  "sessionId": "session-123",
  "published": 0,
  "skipped": 1,
  "skippedAssets": ["_assets/logo.png"]
}
```

### Monitoring Deduplication

Backend logs show deduplication activity:

```
[INFO] Starting parallel processing of 10 assets (max 10 concurrent) existingAssetsCount=25
[INFO] Asset already exists (duplicate hash), skipping upload
  filename="_assets/common-icon.png"
  hash="a1b2c3..."
  existingPath="_assets/common-icon.png"
[DEBUG] New asset uploaded
  filename="_assets/new-diagram.svg"
  hash="d4e5f6..."
  size=2048
  mimeType="image/svg+xml"
[INFO] Manifest updated with all staged assets
  stagedAssetsCount=26
  newCount=1
  skippedCount=9
```

### Promotion Logs

During session finalization, observe selective sync:

```
[DEBUG] Promoting staged content with selective asset sync
  sessionId="session-123"
  referencedAssetsCount=26
[INFO] Asset synchronization completed
  copied=1
  kept=25
  deleted=3
[DEBUG] Staging promoted to production roots
```

## Troubleshooting

### Problem: Assets disappear after promotion

**Symptom:** Assets that were previously accessible are no longer available after publishing a new session.

**Cause:** Asset is not referenced in the manifest (missing from `manifest.assets[]` array).

**Solution:**

1. Check staging manifest before promotion:
   ```bash
   cat /content/.staging/<sessionId>/_manifest.json | jq '.assets'
   ```
2. Verify asset is included in upload results
3. Ensure `UploadAssetsHandler` is called with manifest storage configured
4. Check backend logs for asset upload errors

### Problem: Deduplication not working (assets always uploaded)

**Symptom:** All assets show as `published`, none are `skipped` even when unchanged.

**Cause:** Missing manifest storage or asset hasher in handler configuration.

**Solution:**

Check handler initialization in `apps/node/src/infra/http/express/app.ts`:

```typescript
const assetHasher = new AssetHashService();
const uploadAssetsHandler = new UploadAssetsHandler(
  assetStorageFactory,
  manifestStorageFactory, // ← Must be provided
  assetHasher, // ← Must be provided
  assetValidator,
  maxAssetSizeBytes
);
```

### Problem: Hash mismatch (same content, different hash)

**Symptom:** Asset uploaded multiple times despite identical content.

**Cause:** Content modified during transmission (encoding issues, line ending normalization).

**Root causes:**

- Base64 encoding issues (padding, whitespace)
- Buffer conversion errors
- Content-Type mismatches causing transformations

**Solution:**

1. Enable debug logging: `LOGGER_LEVEL=debug`
2. Check hash computation in logs:
   ```
   [DEBUG] New asset uploaded hash="abc123..." size=1024
   ```
3. Compare hashes for supposedly identical assets
4. If hashes differ, inspect raw bytes:
   ```bash
   sha256sum /assets/_assets/asset.png
   ```

### Problem: Obsolete assets not deleted

**Symptom:** Old assets remain in production even though they're not referenced.

**Cause:** Manifest not updated during upload, or promotion skipped manifest sync.

**Solution:**

1. Verify staging manifest includes all current assets:
   ```bash
   cat /content/.staging/<sessionId>/_manifest.json | jq '.assets | length'
   ```
2. Check promotion logs for "Asset synchronization completed"
3. Manually trigger cleanup if needed:
   ```bash
   # List unreferenced assets (debug-only, not in production code)
   find /assets -type f | while read f; do
     grep -q "$f" /content/_manifest.json || echo "Orphaned: $f"
   done
   ```

### Problem: Performance degradation with large manifests

**Symptom:** Slow asset uploads when manifest contains thousands of assets.

**Cause:** Hash map construction or manifest serialization overhead.

**Solution:**

1. Monitor manifest size:
   ```bash
   wc -l /content/_manifest.json
   ```
2. If `manifest.assets` > 10,000 entries, consider:
   - Archiving old manifests (not yet implemented)
   - Splitting into multiple publishing targets
   - Optimizing hash map data structure (already uses Map for O(1) lookup)

## References

### Source Code

- **Domain:**
  - [ManifestAsset interface](../../libs/core-domain/src/lib/entities/manifest.ts) - Asset metadata with hash
  - [AssetHashPort](../../libs/core-domain/src/lib/ports/asset-hash-port.ts) - Hash computation interface

- **Application:**
  - [UploadAssetsHandler](../../libs/core-application/src/lib/publishing/handlers/upload-assets.handler.ts) - Deduplication logic
  - [UploadAssetsCommand](../../libs/core-application/src/lib/publishing/commands/upload-assets.command.ts) - Command/result types

- **Infrastructure:**
  - [AssetHashService](../../apps/node/src/infra/utils/asset-hash.service.ts) - SHA256 implementation
  - [StagingManager](../../apps/node/src/infra/filesystem/staging-manager.ts) - Selective promotion logic

### Tests

- [asset-deduplication.test.ts](../../libs/core-application/src/lib/_tests/publishing/asset-deduplication.test.ts) - Deduplication scenarios (6 tests)
- [staging-manager-selective-promotion.test.ts](../../apps/node/src/_tests/staging-manager-selective-promotion.test.ts) - Promotion scenarios (5 tests)
- [upload-assets.handler.test.ts](../../libs/core-application/src/lib/_tests/publishing/handlers/upload-assets.handler.test.ts) - Handler integration tests

### Related Documentation

- [Asset Security](./asset-security.md) - MIME detection, size limits, virus scanning
- [Architecture](../architecture.md) - Overall system design
- [Performance](./performance.md) - Optimization strategies

### Implementation Notes

**Feature ID:** B4 (Asset Deduplication via SHA256)

**Completed:**

- ✅ Backend deduplication (API-side hash computation + skip upload)
- ✅ Manifest-driven promotion (selective sync + automatic cleanup)
- ✅ Statistics reporting (published/skipped counts)
- ✅ Integration tests (11 test scenarios)

**Future enhancements:**

- ⏳ Plugin-side deduplication (compute hashes in Obsidian, skip upload entirely)
- ⏳ Manifest size optimization (archive old entries, compression)
- ⏳ Asset pruning API endpoint (manual cleanup trigger)
- ⏳ Deduplication metrics in `/health` endpoint
