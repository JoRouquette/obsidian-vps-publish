import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { UploadAssetsHandler } from '@core-application';
import { type Asset } from '@core-domain';

import { AssetsFileSystemStorage } from '../infra/filesystem/assets-file-system.storage';
import { FileTypeAssetValidator } from '../infra/validation/file-type-asset-validator';

/**
 * Integration test: Upload assets workflow with validation (size + MIME detection)
 * Tests the complete flow: Command → Handler → Validator → Storage
 */
describe('Asset Upload Integration - With Validation', () => {
  let tmpAssetsRoot: string;
  let handler: UploadAssetsHandler;
  const maxSizeBytes = 5 * 1024 * 1024; // 5MB for tests

  beforeEach(async () => {
    tmpAssetsRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'assets-upload-test-'));
    const storage = new AssetsFileSystemStorage(tmpAssetsRoot);
    const validator = new FileTypeAssetValidator();
    handler = new UploadAssetsHandler(storage, validator, maxSizeBytes);
  });

  afterEach(async () => {
    await fs.rm(tmpAssetsRoot, { recursive: true, force: true });
  });

  it('should successfully upload valid PNG with correct MIME detection', async () => {
    // PNG magic bytes
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const pngBuffer = Buffer.concat([pngSignature, Buffer.alloc(100)]);
    const pngBase64 = pngBuffer.toString('base64');

    const asset: Asset = {
      relativePath: 'images/test.png',
      vaultPath: 'vault/images/test.png',
      fileName: 'test.png',
      mimeType: 'image/png', // Client claims PNG (correct)
      contentBase64: pngBase64,
    };

    const result = await handler.handle({
      sessionId: 'test-session',
      assets: [asset],
    });

    expect(result.published).toBe(1);
    expect(result.errors).toBeUndefined();

    // Verify file was written
    const savedPath = path.join(tmpAssetsRoot, 'images', 'test.png');
    const savedContent = await fs.readFile(savedPath);
    expect(savedContent).toEqual(pngBuffer);
  });

  it('should detect MIME spoofing and accept with corrected MIME', async () => {
    // PNG bytes but client claims JPEG
    const pngSignature = Buffer.from([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a, // PNG signature
      0x00,
      0x00,
      0x00,
      0x0d, // IHDR chunk length
      0x49,
      0x48,
      0x44,
      0x52, // IHDR
    ]);
    const pngBuffer = Buffer.concat([pngSignature, Buffer.alloc(200)]);
    const pngBase64 = pngBuffer.toString('base64');

    const spoofedAsset: Asset = {
      relativePath: 'fake.png', // Use .png extension
      vaultPath: 'vault/fake.png',
      fileName: 'fake.png',
      mimeType: 'image/jpeg', // 🔴 Client lies (claims JPEG but sends PNG)
      contentBase64: pngBase64,
    };

    const result = await handler.handle({
      sessionId: 'test-session',
      assets: [spoofedAsset],
    });

    // Should succeed (we accept with detected MIME, not reject)
    expect(result.published).toBe(1);
    expect(result.errors).toBeUndefined();

    // Verify the MIME was corrected in-place (asset.mimeType should now be image/png)
    expect(spoofedAsset.mimeType).toBe('image/png'); // Corrected by validator
  });

  it('should reject asset exceeding size limit', async () => {
    // Create 6MB buffer (exceeds 5MB limit)
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024);
    const largeBase64 = largeBuffer.toString('base64');

    const largeAsset: Asset = {
      relativePath: 'large.bin',
      vaultPath: 'vault/large.bin',
      fileName: 'large.bin',
      mimeType: 'application/octet-stream',
      contentBase64: largeBase64,
    };

    const result = await handler.handle({
      sessionId: 'test-session',
      assets: [largeAsset],
    });

    // Should report error
    expect(result.published).toBe(0);
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBe(1);
    expect(result.errors?.[0].message).toMatch(/exceeds maximum allowed/);
  });

  it('should handle batch upload with mixed valid/invalid assets', async () => {
    // Valid small PNG
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const validPngBuffer = Buffer.concat([pngSignature, Buffer.alloc(100)]);

    // Invalid: too large
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024);

    const assets: Asset[] = [
      {
        relativePath: 'valid.png',
        vaultPath: 'vault/valid.png',
        fileName: 'valid.png',
        mimeType: 'image/png',
        contentBase64: validPngBuffer.toString('base64'),
      },
      {
        relativePath: 'toolarge.bin',
        vaultPath: 'vault/toolarge.bin',
        fileName: 'toolarge.bin',
        mimeType: 'application/octet-stream',
        contentBase64: largeBuffer.toString('base64'),
      },
    ];

    const result = await handler.handle({
      sessionId: 'test-session',
      assets,
    });

    // One succeeded, one failed
    expect(result.published).toBe(1);
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBe(1);
    expect(result.errors?.[0].assetName).toBe('toolarge.bin');

    // Valid asset should be saved
    const validPath = path.join(tmpAssetsRoot, 'valid.png');
    const exists = await fs
      .access(validPath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);

    // Invalid asset should NOT be saved
    const invalidPath = path.join(tmpAssetsRoot, 'toolarge.bin');
    const notExists = await fs
      .access(invalidPath)
      .then(() => false)
      .catch(() => true);
    expect(notExists).toBe(true);
  });

  it('should process multiple valid assets in parallel', async () => {
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const assets: Asset[] = Array.from({ length: 20 }, (_, i) => {
      const buffer = Buffer.concat([pngSignature, Buffer.alloc(50)]);
      return {
        relativePath: `image-${i}.png`,
        vaultPath: `vault/image-${i}.png`,
        fileName: `image-${i}.png`,
        mimeType: 'image/png',
        contentBase64: buffer.toString('base64'),
      };
    });

    const result = await handler.handle({
      sessionId: 'test-session',
      assets,
    });

    expect(result.published).toBe(20);
    expect(result.errors).toBeUndefined();

    // Verify all files were written
    for (let i = 0; i < 20; i++) {
      const filePath = path.join(tmpAssetsRoot, `image-${i}.png`);
      const exists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    }
  });
});
