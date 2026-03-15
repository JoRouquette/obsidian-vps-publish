import fs from 'node:fs/promises';
import path from 'node:path';

import { NoopImageOptimizer, SharpImageOptimizer } from '../infra/image';

/**
 * Tests for SharpImageOptimizer - Server-side image optimization
 */
describe('SharpImageOptimizer', () => {
  describe('isOptimizable', () => {
    const optimizer = new SharpImageOptimizer();

    it.each([
      ['image.png', true],
      ['image.PNG', true],
      ['photo.jpg', true],
      ['photo.JPEG', true],
      ['photo.jpeg', true],
      ['image.webp', true],
      ['animation.gif', true],
      ['scan.tiff', true],
      ['scan.tif', true],
      ['modern.avif', true],
      ['document.pdf', false],
      ['text.txt', false],
      ['video.mp4', false],
      ['archive.zip', false],
      ['noextension', false],
      ['path/to/image.png', true],
      ['_assets/photos/vacation.jpg', true],
    ])('should return %s for "%s"', (filename, expected) => {
      expect(optimizer.isOptimizable(filename)).toBe(expected);
    });
  });

  describe('getConfig', () => {
    it('should return default config', () => {
      const optimizer = new SharpImageOptimizer();
      const config = optimizer.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.convertToWebp).toBe(true);
      expect(config.quality).toBe(85);
      expect(config.maxWidth).toBe(4096);
      expect(config.maxHeight).toBe(4096);
      expect(config.maxSizeBytes).toBe(10 * 1024 * 1024);
    });

    it('should merge custom config with defaults', () => {
      const optimizer = new SharpImageOptimizer({
        quality: 70,
        maxWidth: 2048,
      });
      const config = optimizer.getConfig();

      expect(config.quality).toBe(70);
      expect(config.maxWidth).toBe(2048);
      // Defaults preserved
      expect(config.enabled).toBe(true);
      expect(config.convertToWebp).toBe(true);
    });
  });

  describe('optimize - with synthetic images', () => {
    let optimizer: SharpImageOptimizer;

    beforeEach(() => {
      optimizer = new SharpImageOptimizer({ quality: 80 });
    });

    it('should return original when optimization is disabled', async () => {
      const disabledOptimizer = new SharpImageOptimizer({ enabled: false });
      const content = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes

      const result = await disabledOptimizer.optimize(content, 'test.png');

      expect(result.wasOptimized).toBe(false);
      expect(result.data).toEqual(content);
      expect(result.optimizedFilename).toBe('test.png');
    });

    it('should return original for non-optimizable formats', async () => {
      const content = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // PDF magic bytes

      const result = await optimizer.optimize(content, 'document.pdf');

      expect(result.wasOptimized).toBe(false);
      expect(result.data).toEqual(content);
    });
  });

  describe('optimize - with real test images', () => {
    let optimizer: SharpImageOptimizer;
    const testVaultAssetsPath = path.join(process.cwd(), 'test-vault', '_assets');

    beforeEach(() => {
      optimizer = new SharpImageOptimizer({
        quality: 85,
        convertToWebp: true,
      });
    });

    it('should optimize a small PNG and convert to WebP', async () => {
      const imagePath = path.join(testVaultAssetsPath, '_images', 'D20.png');
      const content = await fs.readFile(imagePath);
      const originalSize = content.length;

      const result = await optimizer.optimize(new Uint8Array(content), 'D20.png');

      expect(result.wasOptimized).toBe(true);
      expect(result.format).toBe('webp');
      expect(result.optimizedFilename).toBe('D20.webp');
      expect(result.originalFilename).toBe('D20.png');
      expect(result.originalSize).toBe(originalSize);
      expect(result.optimizedSize).toBeLessThan(originalSize);
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);

      console.log(
        `D20.png: ${(originalSize / 1024).toFixed(1)}KB → ${(result.optimizedSize / 1024).toFixed(1)}KB ` +
          `(${((1 - result.optimizedSize / originalSize) * 100).toFixed(1)}% reduction)`
      );
    });

    it('should optimize a JPEG image', async () => {
      const imagePath = path.join(testVaultAssetsPath, 'BujoKey.jpg');
      const content = await fs.readFile(imagePath);
      const originalSize = content.length;

      const result = await optimizer.optimize(new Uint8Array(content), 'BujoKey.jpg');

      expect(result.wasOptimized).toBe(true);
      expect(result.format).toBe('webp');
      expect(result.optimizedFilename).toBe('BujoKey.webp');
      expect(result.originalSize).toBe(originalSize);

      console.log(
        `BujoKey.jpg: ${(originalSize / 1024).toFixed(1)}KB → ${(result.optimizedSize / 1024).toFixed(1)}KB ` +
          `(${((1 - result.optimizedSize / originalSize) * 100).toFixed(1)}% reduction)`
      );
    });

    it('should optimize a larger PNG with significant compression', async () => {
      const imagePath = path.join(testVaultAssetsPath, 'amber_crossroads.png');
      const content = await fs.readFile(imagePath);
      const originalSize = content.length;

      const result = await optimizer.optimize(new Uint8Array(content), 'amber_crossroads.png');

      expect(result.wasOptimized).toBe(true);
      expect(result.format).toBe('webp');
      expect(result.optimizedFilename).toBe('amber_crossroads.webp');
      // Large PNGs should have significant compression
      expect(result.optimizedSize).toBeLessThan(originalSize * 0.8);

      console.log(
        `amber_crossroads.png: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ` +
          `${(result.optimizedSize / 1024 / 1024).toFixed(2)}MB ` +
          `(${((1 - result.optimizedSize / originalSize) * 100).toFixed(1)}% reduction)`
      );
    });

    it('should preserve JPEG format when preserveFormat is true', async () => {
      const preserveOptimizer = new SharpImageOptimizer({
        preserveFormat: true,
        convertToWebp: false,
      });

      const imagePath = path.join(testVaultAssetsPath, 'BujoKey.jpg');
      const content = await fs.readFile(imagePath);

      const result = await preserveOptimizer.optimize(new Uint8Array(content), 'BujoKey.jpg');

      expect(result.wasOptimized).toBe(true);
      expect(result.format).toBe('jpeg');
      expect(result.optimizedFilename).toBe('BujoKey.jpg');
    });

    it('should resize oversized images', async () => {
      const smallMaxOptimizer = new SharpImageOptimizer({
        maxWidth: 500,
        maxHeight: 500,
      });

      const imagePath = path.join(testVaultAssetsPath, 'amber_crossroads.png');
      const content = await fs.readFile(imagePath);

      const result = await smallMaxOptimizer.optimize(
        new Uint8Array(content),
        'amber_crossroads.png'
      );

      expect(result.wasOptimized).toBe(true);
      expect(result.width).toBeLessThanOrEqual(500);
      expect(result.height).toBeLessThanOrEqual(500);
    });
  });

  describe('optimize - large image handling', () => {
    // Note: This test uses Ektaron.png (46MB) - skip if not available
    it('should handle very large images with aggressive compression', async () => {
      const imagePath = path.join(process.cwd(), 'test-vault', '_assets', '_images', 'Ektaron.png');

      let content: Buffer;
      try {
        content = await fs.readFile(imagePath);
      } catch {
        console.log('Skipping large image test - Ektaron.png not available');
        return;
      }

      // Skip if file is too small (not the expected large file)
      if (content.length < 10 * 1024 * 1024) {
        console.log('Skipping - Ektaron.png is smaller than expected');
        return;
      }

      const optimizer = new SharpImageOptimizer({
        quality: 85,
        maxSizeBytes: 10 * 1024 * 1024, // 10MB target
      });

      const originalSize = content.length;
      console.log(`Processing Ektaron.png: ${(originalSize / 1024 / 1024).toFixed(2)}MB...`);

      const startTime = Date.now();
      const result = await optimizer.optimize(new Uint8Array(content), 'Ektaron.png');
      const duration = Date.now() - startTime;

      expect(result.wasOptimized).toBe(true);
      expect(result.format).toBe('webp');
      expect(result.optimizedFilename).toBe('Ektaron.webp');

      // Should achieve significant compression
      expect(result.optimizedSize).toBeLessThan(originalSize);

      console.log(
        `Ektaron.png: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ` +
          `${(result.optimizedSize / 1024 / 1024).toFixed(2)}MB ` +
          `(${((1 - result.optimizedSize / originalSize) * 100).toFixed(1)}% reduction) ` +
          `in ${duration}ms`
      );
    }, 60000); // 60s timeout for large image
  });

  describe('optimize - quality settings', () => {
    it('should produce smaller files with lower quality', async () => {
      const imagePath = path.join(process.cwd(), 'test-vault', '_assets', '_images', 'D20.png');
      const content = await fs.readFile(imagePath);

      const highQualityOptimizer = new SharpImageOptimizer({ quality: 95 });
      const lowQualityOptimizer = new SharpImageOptimizer({ quality: 50 });

      const highQualityResult = await highQualityOptimizer.optimize(
        new Uint8Array(content),
        'D20.png'
      );
      const lowQualityResult = await lowQualityOptimizer.optimize(
        new Uint8Array(content),
        'D20.png'
      );

      expect(lowQualityResult.optimizedSize).toBeLessThan(highQualityResult.optimizedSize);

      console.log(
        `Quality comparison: Q95=${highQualityResult.optimizedSize}B, Q50=${lowQualityResult.optimizedSize}B`
      );
    });
  });

  describe('optimize - WebP passthrough', () => {
    it('should skip re-compression for small WebP files that do not need resizing', async () => {
      // First, create an optimized WebP from a PNG
      const optimizer = new SharpImageOptimizer({ quality: 85 });
      const imagePath = path.join(process.cwd(), 'test-vault', '_assets', '_images', 'D20.png');
      const pngContent = await fs.readFile(imagePath);

      // Convert PNG to WebP
      const webpResult = await optimizer.optimize(new Uint8Array(pngContent), 'D20.png');
      expect(webpResult.wasOptimized).toBe(true);
      expect(webpResult.format).toBe('webp');

      // Now try to re-optimize the WebP - it should be skipped
      const reOptimizeResult = await optimizer.optimize(webpResult.data, 'D20.webp');

      expect(reOptimizeResult.wasOptimized).toBe(false);
      expect(reOptimizeResult.optimizedFilename).toBe('D20.webp');
      expect(reOptimizeResult.data).toEqual(webpResult.data);
      expect(reOptimizeResult.optimizedSize).toBe(webpResult.optimizedSize);

      console.log(`WebP passthrough: ${webpResult.optimizedSize}B WebP was not re-compressed`);
    });

    it('should still resize oversized WebP files', async () => {
      // Create a WebP then try to resize it
      const createOptimizer = new SharpImageOptimizer({ quality: 85 });
      const resizeOptimizer = new SharpImageOptimizer({
        quality: 85,
        maxWidth: 100,
        maxHeight: 100,
      });

      const imagePath = path.join(process.cwd(), 'test-vault', '_assets', '_images', 'D20.png');
      const pngContent = await fs.readFile(imagePath);

      // Create WebP
      const webpResult = await createOptimizer.optimize(new Uint8Array(pngContent), 'D20.png');
      expect(webpResult.width).toBeGreaterThan(100);

      // Re-optimize with resize required - should process
      const resizedResult = await resizeOptimizer.optimize(webpResult.data, 'D20.webp');

      expect(resizedResult.wasOptimized).toBe(true);
      expect(resizedResult.width).toBeLessThanOrEqual(100);
      expect(resizedResult.height).toBeLessThanOrEqual(100);

      console.log(
        `WebP resize: ${webpResult.width}x${webpResult.height} → ${resizedResult.width}x${resizedResult.height}`
      );
    });
  });
});

describe('NoopImageOptimizer', () => {
  let optimizer: NoopImageOptimizer;

  beforeEach(() => {
    optimizer = new NoopImageOptimizer();
  });

  it('should always return false for isOptimizable', () => {
    expect(optimizer.isOptimizable('image.png')).toBe(false);
    expect(optimizer.isOptimizable('photo.jpg')).toBe(false);
    expect(optimizer.isOptimizable('anything.webp')).toBe(false);
  });

  it('should return config with enabled=false', () => {
    const config = optimizer.getConfig();
    expect(config.enabled).toBe(false);
  });

  it('should pass through content unchanged', async () => {
    const content = new Uint8Array([1, 2, 3, 4, 5]);

    const result = await optimizer.optimize(content, 'test.png');

    expect(result.wasOptimized).toBe(false);
    expect(result.data).toEqual(content);
    expect(result.optimizedFilename).toBe('test.png');
    expect(result.originalFilename).toBe('test.png');
    expect(result.originalSize).toBe(5);
    expect(result.optimizedSize).toBe(5);
    expect(result.format).toBe('png');
  });
});
