import sharp from 'sharp';

import { NoopImageOptimizer, SharpImageOptimizer } from '../infra/image';

/**
 * Helper to generate a synthetic PNG image of specified size
 */
async function generateTestPng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
    },
  })
    .png()
    .toBuffer();
}

/**
 * Helper to generate a synthetic JPEG image of specified size
 */
async function generateTestJpeg(width: number, height: number, quality = 90): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .jpeg({ quality })
    .toBuffer();
}

/**
 * Helper to generate a PNG with noise/complexity (for quality comparison tests)
 * Creates a gradient with noise that will show quality differences
 */
async function generateComplexPng(width: number, height: number): Promise<Buffer> {
  // Create raw pixel buffer with gradient + noise
  const channels = 3;
  const rawData = Buffer.alloc(width * height * channels);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      // Gradient based on position + noise
      const noise = Math.floor(Math.random() * 50);
      rawData[idx] = Math.floor((x / width) * 200) + noise; // R
      rawData[idx + 1] = Math.floor((y / height) * 200) + noise; // G
      rawData[idx + 2] = 128 + noise; // B
    }
  }

  return sharp(rawData, {
    raw: { width, height, channels },
  })
    .png()
    .toBuffer();
}

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

    beforeEach(() => {
      optimizer = new SharpImageOptimizer({
        quality: 85,
        convertToWebp: true,
      });
    });

    it('should optimize a small PNG and convert to WebP', async () => {
      const content = await generateTestPng(200, 200);
      const originalSize = content.length;

      const result = await optimizer.optimize(new Uint8Array(content), 'test-small.png');

      expect(result.wasOptimized).toBe(true);
      expect(result.format).toBe('webp');
      expect(result.optimizedFilename).toBe('test-small.webp');
      expect(result.originalFilename).toBe('test-small.png');
      expect(result.originalSize).toBe(originalSize);
      expect(result.optimizedSize).toBeLessThan(originalSize);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });

    it('should optimize a JPEG image', async () => {
      const content = await generateTestJpeg(400, 300);
      const originalSize = content.length;

      const result = await optimizer.optimize(new Uint8Array(content), 'test-photo.jpg');

      expect(result.wasOptimized).toBe(true);
      expect(result.format).toBe('webp');
      expect(result.optimizedFilename).toBe('test-photo.webp');
      expect(result.originalSize).toBe(originalSize);
    });

    it('should optimize a larger PNG with significant compression', async () => {
      // Generate a larger image (1000x800) that should compress well
      const content = await generateTestPng(1000, 800);
      const originalSize = content.length;

      const result = await optimizer.optimize(new Uint8Array(content), 'large-image.png');

      expect(result.wasOptimized).toBe(true);
      expect(result.format).toBe('webp');
      expect(result.optimizedFilename).toBe('large-image.webp');
      // Large solid-color PNGs should have significant compression to WebP
      expect(result.optimizedSize).toBeLessThan(originalSize);
    });

    it('should preserve JPEG format when preserveFormat is true', async () => {
      const preserveOptimizer = new SharpImageOptimizer({
        preserveFormat: true,
        convertToWebp: false,
      });

      const content = await generateTestJpeg(300, 300);

      const result = await preserveOptimizer.optimize(new Uint8Array(content), 'photo.jpg');

      expect(result.wasOptimized).toBe(true);
      expect(result.format).toBe('jpeg');
      expect(result.optimizedFilename).toBe('photo.jpg');
    });

    it('should resize oversized images', async () => {
      const smallMaxOptimizer = new SharpImageOptimizer({
        maxWidth: 500,
        maxHeight: 500,
      });

      // Generate a 1200x900 image
      const content = await generateTestPng(1200, 900);

      const result = await smallMaxOptimizer.optimize(new Uint8Array(content), 'oversized.png');

      expect(result.wasOptimized).toBe(true);
      expect(result.width).toBeLessThanOrEqual(500);
      expect(result.height).toBeLessThanOrEqual(500);
    });
  });

  describe('optimize - large image handling', () => {
    it('should handle large images with aggressive compression', async () => {
      // Generate a large 2000x1500 image to test compression
      const content = await generateTestPng(2000, 1500);
      const originalSize = content.length;

      const optimizer = new SharpImageOptimizer({
        quality: 85,
        maxSizeBytes: 10 * 1024 * 1024, // 10MB target
      });

      const result = await optimizer.optimize(new Uint8Array(content), 'large-test.png');

      expect(result.wasOptimized).toBe(true);
      expect(result.format).toBe('webp');
      expect(result.optimizedFilename).toBe('large-test.webp');

      // Should achieve significant compression
      expect(result.optimizedSize).toBeLessThan(originalSize);
    });
  });

  describe('optimize - quality settings', () => {
    it('should produce smaller files with lower quality', async () => {
      // Use complex image with noise to show quality differences
      const content = await generateComplexPng(400, 400);

      const highQualityOptimizer = new SharpImageOptimizer({ quality: 95 });
      const lowQualityOptimizer = new SharpImageOptimizer({ quality: 50 });

      const highQualityResult = await highQualityOptimizer.optimize(
        new Uint8Array(content),
        'quality-test.png'
      );
      const lowQualityResult = await lowQualityOptimizer.optimize(
        new Uint8Array(content),
        'quality-test.png'
      );

      expect(lowQualityResult.optimizedSize).toBeLessThan(highQualityResult.optimizedSize);
    });
  });

  describe('optimize - WebP passthrough', () => {
    it('should skip re-compression for small WebP files that do not need resizing', async () => {
      const optimizer = new SharpImageOptimizer({ quality: 85 });
      const pngContent = await generateTestPng(300, 300);

      // Convert PNG to WebP
      const webpResult = await optimizer.optimize(new Uint8Array(pngContent), 'passthrough.png');
      expect(webpResult.wasOptimized).toBe(true);
      expect(webpResult.format).toBe('webp');

      // Now try to re-optimize the WebP - it should be skipped
      const reOptimizeResult = await optimizer.optimize(webpResult.data, 'passthrough.webp');

      expect(reOptimizeResult.wasOptimized).toBe(false);
      expect(reOptimizeResult.optimizedFilename).toBe('passthrough.webp');
      expect(reOptimizeResult.data).toEqual(webpResult.data);
      expect(reOptimizeResult.optimizedSize).toBe(webpResult.optimizedSize);
    });

    it('should still resize oversized WebP files', async () => {
      // Create a WebP then try to resize it
      const createOptimizer = new SharpImageOptimizer({ quality: 85 });
      const resizeOptimizer = new SharpImageOptimizer({
        quality: 85,
        maxWidth: 100,
        maxHeight: 100,
      });

      const pngContent = await generateTestPng(500, 500);

      // Create WebP
      const webpResult = await createOptimizer.optimize(
        new Uint8Array(pngContent),
        'resize-test.png'
      );
      expect(webpResult.width).toBeGreaterThan(100);

      // Re-optimize with resize required - should process
      const resizedResult = await resizeOptimizer.optimize(webpResult.data, 'resize-test.webp');

      expect(resizedResult.wasOptimized).toBe(true);
      expect(resizedResult.width).toBeLessThanOrEqual(100);
      expect(resizedResult.height).toBeLessThanOrEqual(100);
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
