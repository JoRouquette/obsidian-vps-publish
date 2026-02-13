import { createHash } from 'node:crypto';

import type { Asset, AssetHashPort, Manifest } from '@core-domain';

import { UploadAssetsHandler } from '../../publishing/handlers/upload-assets.handler';
import type { AssetStoragePort } from '../../publishing/ports/assets-storage.port';
import type { ManifestPort } from '../../publishing/ports/manifest-storage.port';

/**
 * Mock implementation of AssetHashPort for testing
 */
class MockAssetHasher implements AssetHashPort {
  async computeHash(buffer: Buffer | Uint8Array): Promise<string> {
    return createHash('sha256').update(buffer).digest('hex');
  }
}

/**
 * Integration tests for asset deduplication via SHA256 hash comparison.
 * Tests the B4 feature: skip re-upload of identical assets.
 */
describe('Asset Deduplication (B4)', () => {
  let storage: jest.Mocked<AssetStoragePort>;
  let manifestStorage: jest.Mocked<ManifestPort>;
  let assetHasher: MockAssetHasher;
  let handler: UploadAssetsHandler;

  const mockSessionId = 'session-123';

  beforeEach(() => {
    storage = {
      save: jest.fn().mockResolvedValue(undefined),
      load: jest.fn().mockResolvedValue(null),
      exists: jest.fn().mockResolvedValue(false),
      remove: jest.fn().mockResolvedValue(undefined),
    } as jest.Mocked<AssetStoragePort>;

    manifestStorage = {
      load: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
      rebuildIndex: jest.fn().mockResolvedValue(undefined),
    } as jest.Mocked<ManifestPort>;

    assetHasher = new MockAssetHasher();
    handler = new UploadAssetsHandler(storage, manifestStorage, assetHasher, undefined, undefined);
  });

  const createMockAsset = (filename: string, contentBase64: string): Asset => ({
    fileName: filename,
    relativePath: `_assets/${filename}`,
    vaultPath: `vault/${filename}`,
    contentBase64,
    mimeType: 'image/png',
  });

  describe('Empty manifest (first upload)', () => {
    it('should upload all assets when no manifest exists', async () => {
      manifestStorage.load.mockResolvedValue(null);

      const asset1 = createMockAsset('image1.png', Buffer.from('content1').toString('base64'));
      const asset2 = createMockAsset('image2.jpg', Buffer.from('content2').toString('base64'));

      const result = await handler.handle({
        sessionId: mockSessionId,
        assets: [asset1, asset2],
      });

      expect(result.published).toBe(2);
      expect(result.skipped).toBeUndefined();
      expect(storage.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('With existing assets in manifest', () => {
    it('should skip re-upload of identical asset (same hash) and preserve in manifest', async () => {
      const assetContent = Buffer.from('test content for image');
      const assetBase64 = assetContent.toString('base64');
      const assetHash = await assetHasher.computeHash(assetContent);

      // Mock manifest with existing asset
      const existingManifest: Manifest = {
        sessionId: 'old-session',
        createdAt: new Date('2026-01-01'),
        lastUpdatedAt: new Date('2026-01-01'),
        pages: [],
        assets: [
          {
            path: '_assets/existing-image.png',
            hash: assetHash,
            size: assetContent.length,
            mimeType: 'image/png',
            uploadedAt: new Date('2026-01-01'),
          },
        ],
      };

      manifestStorage.load.mockResolvedValue(existingManifest);

      const asset = createMockAsset('duplicate-image.png', assetBase64);

      const result = await handler.handle({
        sessionId: mockSessionId,
        assets: [asset],
      });

      // Asset should be skipped (not uploaded)
      expect(result.published).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.skippedAssets).toEqual(['_assets/duplicate-image.png']);
      expect(storage.save).not.toHaveBeenCalled();

      // But manifest should be updated with the asset still present
      expect(manifestStorage.save).toHaveBeenCalled();
      const savedManifest = manifestStorage.save.mock.calls[0][0];
      expect(savedManifest.assets).toHaveLength(1);
      expect(savedManifest.assets![0].hash).toBe(assetHash);
    });

    it('should upload asset with different hash', async () => {
      const existingContent = Buffer.from('existing content');
      const existingHash = await assetHasher.computeHash(existingContent);

      const existingManifest: Manifest = {
        sessionId: 'old-session',
        createdAt: new Date('2026-01-01'),
        lastUpdatedAt: new Date('2026-01-01'),
        pages: [],
        assets: [
          {
            path: '_assets/image.png',
            hash: existingHash,
            size: existingContent.length,
            mimeType: 'image/png',
            uploadedAt: new Date('2026-01-01'),
          },
        ],
      };

      manifestStorage.load.mockResolvedValue(existingManifest);

      // Upload asset with DIFFERENT content (different hash)
      const newContent = Buffer.from('NEW different content');
      const newBase64 = newContent.toString('base64');
      const newHash = await assetHasher.computeHash(newContent);

      const asset = createMockAsset('new-image.jpg', newBase64);

      const result = await handler.handle({
        sessionId: mockSessionId,
        assets: [asset],
      });

      expect(result.published).toBe(1);
      expect(result.skipped).toBeUndefined();
      expect(storage.save).toHaveBeenCalledTimes(1);

      // Manifest should have only the new asset (staging manifest, not cumulative)
      expect(manifestStorage.save).toHaveBeenCalled();
      const savedManifest = manifestStorage.save.mock.calls[0][0];
      expect(savedManifest.assets).toHaveLength(1);
      expect(savedManifest.assets![0].hash).toBe(newHash);
    });

    it('should handle mixed batch: skip duplicates + upload new assets', async () => {
      const asset1Content = Buffer.from('asset1 content');
      const asset1Hash = await assetHasher.computeHash(asset1Content);
      const asset3Content = Buffer.from('asset3 content');
      const asset3Hash = await assetHasher.computeHash(asset3Content);

      const existingManifest: Manifest = {
        sessionId: 'old-session',
        createdAt: new Date('2026-01-01'),
        lastUpdatedAt: new Date('2026-01-01'),
        pages: [],
        assets: [
          {
            path: '_assets/asset1.png',
            hash: asset1Hash,
            size: asset1Content.length,
            mimeType: 'image/png',
            uploadedAt: new Date('2026-01-01'),
          },
          {
            path: '_assets/asset3.webp',
            hash: asset3Hash,
            size: asset3Content.length,
            mimeType: 'image/webp',
            uploadedAt: new Date('2026-01-01'),
          },
        ],
      };

      manifestStorage.load.mockResolvedValue(existingManifest);

      // Batch: asset1 (exists), asset2 (new), asset3 (exists)
      const asset1 = createMockAsset('asset1.png', asset1Content.toString('base64'));
      const asset2 = createMockAsset('asset2.jpg', Buffer.from('asset2 NEW').toString('base64'));
      const asset3 = createMockAsset('asset3.webp', asset3Content.toString('base64'));

      const result = await handler.handle({
        sessionId: mockSessionId,
        assets: [asset1, asset2, asset3],
      });

      expect(result.published).toBe(1); // Only asset2 uploaded
      expect(result.skipped).toBe(2); // asset1 and asset3 skipped
      expect(result.skippedAssets).toEqual(['_assets/asset1.png', '_assets/asset3.webp']);
      expect(storage.save).toHaveBeenCalledTimes(1);

      // Manifest should have all 3 assets
      const savedManifest = manifestStorage.save.mock.calls[0][0];
      expect(savedManifest.assets).toHaveLength(3);
    });
  });

  describe('Hash computation', () => {
    it('should compute identical hashes for identical content', async () => {
      const content = Buffer.from('same content');
      const hash1 = await assetHasher.computeHash(content);
      const hash2 = await assetHasher.computeHash(content);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 = 64 hex chars
    });

    it('should compute different hashes for different content', async () => {
      const content1 = Buffer.from('content A');
      const content2 = Buffer.from('content B');

      const hash1 = await assetHasher.computeHash(content1);
      const hash2 = await assetHasher.computeHash(content2);

      expect(hash1).not.toBe(hash2);
    });
  });
});
