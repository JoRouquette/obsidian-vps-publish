# Thumbnail Generation System - Implementation Guide

## Purpose

This document provides architectural guidance and implementation strategy for adding an **automatic thumbnail generation system** to obsidian-vps-publish. Thumbnails improve performance by serving smaller image versions for list views, grids, and previews while preserving originals for full-size display.

**Status**: 🔶 **Design Document** (not yet implemented)

This is a LOW priority feature. Implementation should be deferred until core functionality is stable and user demand justifies the complexity.

---

## When to Use

Implement thumbnail generation when:

- **Large image collections**: Vault contains hundreds of images used in gallery/list views
- **Performance bottleneck**: Full-size images (2-10MB each) slowing down page load times
- **Mobile optimization**: Need smaller assets for bandwidth-constrained devices
- **CDN cost optimization**: Serving thumbnails reduces egress bandwidth costs
- **User experience**: Gallery views require faster loading than current full-size images

**Do NOT implement** when:

- Vault has < 50 images (overhead not justified)
- All images already optimized (< 200KB each)
- Server resources limited (thumbnail generation CPU-intensive)
- Storage cost is primary concern (thumbnails add 10-30% storage overhead)

---

## Key Concepts

### Thumbnail Strategy

**Recommended approach**: Generate thumbnails **on-demand during asset upload**, not at serving time.

#### Benefits:

- One-time generation cost (upload time acceptable)
- Serving is fast (static files,no processing)
- CDN-friendly (immutable thumbnails cached permanently)
- No runtime CPU overhead

#### Alternatives (not recommended):

- **On-demand at serve time**: High CPU load, inconsistent latency
- **Batch post-processing**: Race conditions with content serving
- **Client-side resizing**: Wastes bandwidth downloading full image first

### Thumbnail Sizes

Propose **3 standard sizes** to cover common use cases:

| Size       | Dimensions | Use Case                      | Target File Size |
| ---------- | ---------- | ----------------------------- | ---------------- |
| **Small**  | 150x150px  | List icons, avatars           | 5-15KB           |
| **Medium** | 400x400px  | Gallery grid, cards           | 20-50KB          |
| **Large**  | 800x800px  | Modal previews, hero sections | 50-150KB         |

**Aspect ratio**: Preserve original aspect ratio (no cropping), fit within dimensions.

**Format**:

- Source PNG/JPEG → WebP thumbnails (60-80% smaller, modern browser support)
- Fallback JPEG for older browsers (if needed)

### File Organization

Store thumbnails alongside originals with `_thumb` suffix:

```
ASSETS_ROOT/
  _assets/
    diagram-architecture.png          (original, e.g. 2.5MB)
    diagram-architecture_thumb-sm.webp  (150px, 8KB)
    diagram-architecture_thumb-md.webp  (400px, 35KB)
    diagram-architecture_thumb-lg.webp  (800px, 120KB)
    photo-vacation.jpg                (original, 4MB)
    photo-vacation_thumb-sm.webp      (150px, 12KB)
    photo-vacation_thumb-md.webp      (400px, 45KB)
    photo-vacation_thumb-lg.webp      (800px, 180KB)
```

**Naming convention**:

- `{originalName}_thumb-{size}.{format}`
- Original extension preserved in base name (for clarity)
- Thumbnail format explicit (`.webp`, `.jpg`)

### Manifest Integration

Extend `ManifestAsset` to include thumbnail references:

```typescript
// libs/core-domain/src/lib/entities/manifest.ts

export interface ManifestAsset {
  path: string; // Original asset path
  hash: string; // SHA256 of original
  size: number; // Original file size in bytes
  mimeType: string; // Original MIME type
  uploadedAt: Date;

  // NEW: Thumbnail metadata
  thumbnails?: {
    small?: {
      path: string; // e.g., "_assets/image_thumb-sm.webp"
      size: number; // Thumbnail file size
      width: number; // Actual width (may differ if aspect ratio preserved)
      height: number; // Actual height
    };
    medium?: {
      path: string;
      size: number;
      width: number;
      height: number;
    };
    large?: {
      path: string;
      size: number;
      width: number;
      height: number;
    };
  };
}
```

**Example manifest entry**:

```json
{
  "path": "_assets/diagram-architecture.png",
  "hash": "abc123...",
  "size": 2621440,
  "mimeType": "image/png",
  "uploadedAt": "2026-02-13T18:00:00.000Z",
  "thumbnails": {
    "small": {
      "path": "_assets/diagram-architecture_thumb-sm.webp",
      "size": 8192,
      "width": 150,
      "height": 100
    },
    "medium": {
      "path": "_assets/diagram-architecture_thumb-md.webp",
      "size": 35840,
      "width": 400,
      "height": 267
    },
    "large": {
      "path": "_assets/diagram-architecture_thumb-lg.webp",
      "size": 122880,
      "width": 800,
      "height": 533
    }
  }
}
```

---

## Architecture Design

### Layer Organization (Clean Architecture)

#### 1. Domain Layer (`libs/core-domain`)

**New Port**:

```typescript
// libs/core-domain/src/lib/ports/thumbnail-generator-port.ts

export interface ThumbnailSize {
  readonly width: number;
  readonly height: number;
  readonly quality: number; // 1-100
  readonly format: 'webp' | 'jpeg';
}

export interface GeneratedThumbnail {
  readonly buffer: Buffer;
  readonly width: number; // Actual dimensions after resize
  readonly height: number;
  readonly size: number; // File size in bytes
  readonly format: string;
}

export interface ThumbnailGeneratorPort {
  /**
   * Generate thumbnail from image buffer
   * @param sourceBuffer Original image data
   * @param targetSize Desired dimensions and format
   * @returns Generated thumbnail metadata and buffer
   * @throws {ThumbnailGenerationError} if processing fails
   */
  generate(sourceBuffer: Buffer, targetSize: ThumbnailSize): Promise<GeneratedThumbnail>;

  /**
   * Check if MIME type supports thumbnail generation
   * @param mimeType MIME type to check (e.g., 'image/png')
   * @returns true if thumbnails can be generated
   */
  supportsThumbnails(mimeType: string): boolean;
}
```

**New Domain Entity** (extended):

```typescript
// libs/core-domain/src/lib/entities/manifest.ts (already shown above)

export interface ThumbnailMetadata {
  path: string;
  size: number;
  width: number;
  height: number;
}

export interface ManifestAsset {
  // ... existing fields
  thumbnails?: {
    small?: ThumbnailMetadata;
    medium?: ThumbnailMetadata;
    large?: ThumbnailMetadata;
  };
}
```

**New Domain Error**:

```typescript
// libs/core-domain/src/lib/errors/thumbnail-error.ts

export class ThumbnailGenerationError extends Error {
  constructor(
    message: string,
    public readonly assetPath: string,
    public readonly reason: string
  ) {
    super(message);
    this.name = 'ThumbnailGenerationError';
  }
}
```

#### 2. Application Layer (`libs/core-application`)

**Modified Command**: `UploadAssetsCommand` (no change needed, thumbnails generated automatically)

**Modified Handler**: `UploadAssetsHandler`

```typescript
// libs/core-application/src/lib/publishing/handlers/upload-assets.handler.ts

export class UploadAssetsHandler {
  constructor(
    private readonly assetStorage: AssetsStoragePort,
    private readonly assetValidator: AssetValidatorPort,
    private readonly assetHasher: AssetHashPort,
    private readonly thumbnailGenerator: ThumbnailGeneratorPort, // NEW dependency
    private readonly logger?: LoggerPort
  ) {}

  async handle(command: UploadAssetsCommand): Promise<UploadAssetsResult> {
    // ... existing validation and deduplication logic

    for (const asset of command.assets) {
      const validationResult = await this.assetValidator.validate(/* ... */);

      // NEW: Generate thumbnails for supported image types
      let thumbnails: ManifestAsset['thumbnails'];

      if (this.thumbnailGenerator.supportsThumbnails(validationResult.detectedMimeType)) {
        try {
          thumbnails = await this.generateThumbnails(asset.data, asset.path);
          statistics.thumbnailsGenerated += Object.keys(thumbnails).length;
        } catch (error) {
          this.logger?.warn('Thumbnail generation failed', {
            assetPath: asset.path,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue without thumbnails (graceful degradation)
        }
      }

      // Save original asset
      await this.assetStorage.save(asset.path, asset.data);

      // Save thumbnails
      if (thumbnails) {
        await this.saveThumbnails(asset.path, thumbnails);
      }

      // Add to manifest with thumbnail metadata
      allStagedAssets.push({
        path: asset.path,
        hash: assetHash,
        size: asset.data.length,
        mimeType: validationResult.detectedMimeType,
        uploadedAt: new Date(),
        thumbnails, // NEW field
      });
    }

    return {
      assetsUploaded: newCount,
      assetsSkipped: skippedCount,
      thumbnailsGenerated: statistics.thumbnailsGenerated, // NEW metric
      bytesDeduped: statistics.bytesDeduped,
    };
  }

  private async generateThumbnails(
    imageBuffer: Buffer,
    originalPath: string
  ): Promise<ManifestAsset['thumbnails']> {
    const sizes: Array<{ key: 'small' | 'medium' | 'large'; config: ThumbnailSize }> = [
      { key: 'small', config: { width: 150, height: 150, quality: 80, format: 'webp' } },
      { key: 'medium', config: { width: 400, height: 400, quality: 85, format: 'webp' } },
      { key: 'large', config: { width: 800, height: 800, quality: 90, format: 'webp' } },
    ];

    const result: ManifestAsset['thumbnails'] = {};

    for (const { key, config } of sizes) {
      const thumbnail = await this.thumbnailGenerator.generate(imageBuffer, config);
      const thumbnailPath = this.buildThumbnailPath(originalPath, key, config.format);

      result[key] = {
        path: thumbnailPath,
        size: thumbnail.size,
        width: thumbnail.width,
        height: thumbnail.height,
      };

      // Store thumbnail buffer for saving
      // (implementation detail: cache in memory or return with metadata)
    }

    return result;
  }

  private buildThumbnailPath(originalPath: string, size: string, format: string): string {
    const ext = path.extname(originalPath);
    const base = path.basename(originalPath, ext);
    const dir = path.dirname(originalPath);
    return path.join(dir, `${base}_thumb-${size}.${format}`);
  }

  private async saveThumbnails(
    originalPath: string,
    thumbnails: ManifestAsset['thumbnails']
  ): Promise<void> {
    // Save each thumbnail buffer to storage
    // (buffers cached from generation step)
  }
}
```

#### 3. Infrastructure Layer (`apps/node/src/infra`)

**Implementation**: Use `sharp` library (industry standard for Node.js image processing)

```typescript
// apps/node/src/infra/images/sharp-thumbnail-generator.ts

import sharp from 'sharp';
import type { ThumbnailGeneratorPort, ThumbnailSize, GeneratedThumbnail } from '@core-domain';
import { ThumbnailGenerationError } from '@core-domain';

export class SharpThumbnailGenerator implements ThumbnailGeneratorPort {
  private readonly SUPPORTED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif', // Only first frame
    'image/tiff',
    'image/svg+xml',
  ];

  supportsThumbnails(mimeType: string): boolean {
    return this.SUPPORTED_MIME_TYPES.includes(mimeType.toLowerCase());
  }

  async generate(sourceBuffer: Buffer, targetSize: ThumbnailSize): Promise<GeneratedThumbnail> {
    try {
      const image = sharp(sourceBuffer);

      //Get original metadata
      const metadata = await image.metadata();

      // Resize with aspect ratio preserved (fit within box)
      const resized = await image
        .resize(targetSize.width, targetSize.height, {
          fit: 'inside', // Preserve aspect ratio, fit within dimensions
          withoutEnlargement: true, // Don't upscale small images
        })
        .toFormat(targetSize.format, {
          quality: targetSize.quality,
        })
        .toBuffer({ resolveWithObject: true });

      return {
        buffer: resized.data,
        width: resized.info.width,
        height: resized.info.height,
        size: resized.data.length,
        format: targetSize.format,
      };
    } catch (error) {
      throw new ThumbnailGenerationError(
        'Failed to generate thumbnail',
        'unknown', // originalPath not passed here (handler context)
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}
```

**Add dependency**:

```json
// package.json (root)

{
  "dependencies": {
    "sharp": "^0.33.0"
  }
}
```

**Note**: `sharp` requires native binaries. Docker build must include build tools:

```dockerfile
# Dockerfile (add to builder stage)

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    vips-dev  # Required for sharp
```

#### 4. Wiring (Dependency Injection)

```typescript
// apps/node/src/infra/http/express/app.ts

import { SharpThumbnailGenerator } from '../images/sharp-thumbnail-generator';

// ... existing setup

const thumbnailGenerator = new SharpThumbnailGenerator();

const uploadAssetsHandler = new UploadAssetsHandler(
  assetStorage,
  assetValidator,
  assetHasher,
  thumbnailGenerator, // NEW dependency
  rootLogger
);
```

---

## Configuration

### Environment Variables

Add optional thumbnail configuration:

```bash
# .env.dev / .env.prod

# Thumbnail generation
THUMBNAILS_ENABLED=true                # Enable/disable thumbnail generation (default: true)
THUMBNAIL_SIZES=small,medium,large     # Which sizes to generate (default: all)
THUMBNAIL_FORMAT=webp                  # Output format: webp or jpeg (default: webp)
THUMBNAIL_QUALITY=85                   # JPEG/WebP quality 1-100 (default: 85)

# Performance tuning
THUMBNAIL_CONCURRENCY=4                # Max concurrent thumbnail generations (default: 4)
THUMBNAIL_MAX_SOURCE_SIZE=10485760     # Max source image size for thumbnails (10MB default)
```

### Configuration Service

```typescript
// apps/node/src/infra/config/env-config.ts

export class EnvConfig {
  // ... existing methods

  static thumbnailsEnabled(): boolean {
    return process.env.THUMBNAILS_ENABLED !== 'false'; // Default true
  }

  static thumbnailSizes(): Array<'small' | 'medium' | 'large'> {
    const sizes = process.env.THUMBNAIL_SIZES || 'small,medium,large';
    return sizes.split(',') as any;
  }

  static thumbnailFormat(): 'webp' | 'jpeg' {
    return (process.env.THUMBNAIL_FORMAT || 'webp') as any;
  }

  static thumbnailQuality(): number {
    return parseInt(process.env.THUMBNAIL_QUALITY || '85', 10);
  }

  static thumbnailConcurrency(): number {
    return parseInt(process.env.THUMBNAIL_CONCURRENCY || '4', 10);
  }
}
```

---

## Usage

### Frontend Integration (Site Angular App)

**Update image rendering to use thumbnails**:

```typescript
// apps/site/src/app/components/image-gallery/image-gallery.component.ts

export class ImageGalleryComponent {
  @Input() assets: ManifestAsset[] = [];

  getThumbnailUrl(asset: ManifestAsset, size: 'small' | 'medium' | 'large'): string {
    // Use thumbnail if available, fallback to original
    return asset.thumbnails?.[size]?.path || asset.path;
  }

  getOriginalUrl(asset: ManifestAsset): string {
    return asset.path;
  }
}
```

```html
<!-- apps/site/src/app/components/image-gallery/image-gallery.component.html -->

<div class="gallery-grid">
  <div *ngFor="let asset of assets" class="gallery-item">
    <!-- Show medium thumbnail in grid -->
    <img
      [src]="getThumbnailUrl(asset, 'medium')"
      [alt]="asset.path"
      loading="lazy"
      (click)="openFullSize(asset)"
    />
  </div>
</div>

<!-- Full-size modal -->
<div *ngIf="selectedAsset" class="modal">
  <!-- Show large thumbnail initially (fast load), then original on demand -->
  <img [src]="getThumbnailUrl(selectedAsset, 'large')" [alt]="selectedAsset.path" loading="eager" />
  <a [href]="getOriginalUrl(selectedAsset)" target="_blank">View Original</a>
</div>
```

**Lazy loading strategy**:

```html
<!-- List view: small thumbnails -->
<img [src]="getThumbnailUrl(asset, 'small')" loading="lazy" />

<!-- Card grid: medium thumbnails -->
<img [src]="getThumbnailUrl(asset, 'medium')" loading="lazy" />

<!-- Full view: large thumbnail (instant) → original (progressive) -->
<img
  [src]="getThumbnailUrl(asset, 'large')"
  [attr.data-original]="getOriginalUrl(asset)"
  (click)="loadOriginal($event)"
/>
```

### Plugin Changes (Obsidian)

No plugin changes required. Thumbnails generated automatically by backend during asset upload.

**Optional enhancement**: Show thumbnail generation progress in plugin UI:

```typescript
// apps/obsidian-vps-publish/src/lib/upload-manager.ts

interface UploadProgress {
  assetsUploaded: number;
  assetsTotal: number;
  thumbnailsGenerated: number; // NEW metric
  bytesUploaded: number;
}

// Update progress display
this.updateStatusBar(
  `Uploaded ${progress.assetsUploaded}/${progress.assetsTotal} assets, generated ${progress.thumbnailsGenerated} thumbnails`
);
```

---

## Testing Strategy

### Unit Tests

**Test thumbnail generation**:

```typescript
// apps/node/src/_tests/sharp-thumbnail-generator.test.ts

import { SharpThumbnailGenerator } from '../infra/images/sharp-thumbnail-generator';
import fs from 'fs/promises';
import path from 'path';

describe('SharpThumbnailGenerator', () => {
  let generator: SharpThumbnailGenerator;

  beforeEach(() => {
    generator = new SharpThumbnailGenerator();
  });

  it('should generate small thumbnail from PNG', async () => {
    const sourceBuffer = await fs.readFile(path.join(__dirname, 'fixtures', 'test-image.png'));

    const thumbnail = await generator.generate(sourceBuffer, {
      width: 150,
      height: 150,
      quality: 80,
      format: 'webp',
    });

    expect(thumbnail.width).toBeLessThanOrEqual(150);
    expect(thumbnail.height).toBeLessThanOrEqual(150);
    expect(thumbnail.size).toBeLessThan(sourceBuffer.length); // Smaller than original
    expect(thumbnail.format).toBe('webp');
  });

  it('should preserve aspect ratio when resizing', async () => {
    // Source: 800x600 (4:3 ratio)
    const sourceBuffer = await fs.readFile(path.join(__dirname, 'fixtures', 'landscape.jpg'));

    const thumbnail = await generator.generate(sourceBuffer, {
      width: 400,
      height: 400,
      quality: 85,
      format: 'webp',
    });

    // Should fit within 400x400 while preserving 4:3 ratio
    // Expected: 400x300 (width maxed out, height scaled proportionally)
    expect(thumbnail.width).toBe(400);
    expect(thumbnail.height).toBe(300);
  });

  it('should not upscale small images', async () => {
    // Source: 100x100
    const sourceBuffer = await fs.readFile(path.join(__dirname, 'fixtures', 'small-icon.png'));

    const thumbnail = await generator.generate(sourceBuffer, {
      width: 400,
      height: 400,
      quality: 85,
      format: 'webp',
    });

    // Should remain 100x100 (not upscaled to 400x400)
    expect(thumbnail.width).toBe(100);
    expect(thumbnail.height).toBe(100);
  });

  it('should support multiple image formats', async () => {
    const formats = ['png', 'jpg', 'webp', 'gif'];

    for (const format of formats) {
      const mimeType = `image/${format === 'jpg' ? 'jpeg' : format}`;
      expect(generator.supportsThumbnails(mimeType)).toBe(true);
    }

    expect(generator.supportsThumbnails('application/pdf')).toBe(false);
  });

  it('should throw ThumbnailGenerationError for corrupted image', async () => {
    const corruptedBuffer = Buffer.from('not-an-image');

    await expect(
      generator.generate(corruptedBuffer, {
        width: 150,
        height: 150,
        quality: 80,
        format: 'webp',
      })
    ).rejects.toThrow('Failed to generate thumbnail');
  });
});
```

**Test handler integration**:

```typescript
// libs/core-application/src/lib/_tests/publishing/upload-assets-thumbnails.test.ts

describe('UploadAssetsHandler - Thumbnail Generation', () => {
  it('should generate thumbnails for uploaded images', async () => {
    const imageBuffer = Buffer.from('fake-png-data'); // Use real PNG in actual test

    const result = await handler.handle({
      sessionId: 'test-session',
      assets: [
        {
          path: '_assets/diagram.png',
          data: imageBuffer,
          clientMimeType: 'image/png',
        },
      ],
    });

    expect(result.thumbnailsGenerated).toBe(3); // small, medium, large

    // Verify thumbnails saved to storage
    const savedAssets = await assetStorage.list('_assets/');
    expect(savedAssets).toContain('diagram.png');
    expect(savedAssets).toContain('diagram_thumb-sm.webp');
    expect(savedAssets).toContain('diagram_thumb-md.webp');
    expect(savedAssets).toContain('diagram_thumb-lg.webp');
  });

  it('should gracefully handle thumbnail generation failure', async () => {
    // Mock thumbnail generator to throw error
    jest.spyOn(thumbnailGenerator, 'generate').mockRejectedValue(new Error('Sharp error'));

    const result = await handler.handle({
      sessionId: 'test-session',
      assets: [
        {
          path: '_assets/corrupted.png',
          data: Buffer.from('corrupted'),
          clientMimeType: 'image/png',
        },
      ],
    });

    // Should continue without thumbnails (no exception)
    expect(result.assetsUploaded).toBe(1);
    expect(result.thumbnailsGenerated).toBe(0);
  });

  it('should skip thumbnail generation for non-image assets', async () => {
    const result = await handler.handle({
      sessionId: 'test-session',
      assets: [
        {
          path: '_assets/document.pdf',
          data: Buffer.from('pdf-content'),
          clientMimeType: 'application/pdf',
        },
      ],
    });

    expect(result.thumbnailsGenerated).toBe(0);
    // Only original PDF saved, no thumbnails
  });
});
```

### Integration Tests

**Test end-to-end upload with thumbnails**:

```typescript
// apps/node/src/_tests/asset-upload-thumbnails-integration.test.ts

describe('Asset Upload with Thumbnails (E2E)', () => {
  it('should upload image and generate all thumbnail sizes', async () => {
    // 1. Start session
    const sessionRes = await request(app)
      .post('/api/session/start')
      .set('x-api-key', apiKey)
      .send({ noteCount: 0, assetCount: 1 });

    const sessionId = sessionRes.body.sessionId;

    // 2. Upload image asset
    const imagePath = path.join(__dirname, 'fixtures', 'test-photo.jpg');
    const uploadRes = await request(app)
      .post(`/api/session/${sessionId}/assets/upload`)
      .set('x-api-key', apiKey)
      .attach('assets', imagePath);

    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.thumbnailsGenerated).toBe(3);

    // 3. Finish session
    await request(app).post(`/api/session/${sessionId}/finish`).set('x-api-key', apiKey);

    // 4. Verify manifest includes thumbnail metadata
    const manifestPath = path.join(contentRoot, '_manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

    const asset = manifest.assets.find((a: any) => a.path.includes('test-photo.jpg'));
    expect(asset.thumbnails).toBeDefined();
    expect(asset.thumbnails.small).toBeDefined();
    expect(asset.thumbnails.medium).toBeDefined();
    expect(asset.thumbnails.large).toBeDefined();

    // 5. Verify thumbnail files exist
    const assetsRoot = EnvConfig.assetsRoot();
    await expect(
      fs.access(path.join(assetsRoot, asset.thumbnails.small.path))
    ).resolves.not.toThrow();
    await expect(
      fs.access(path.join(assetsRoot, asset.thumbnails.medium.path))
    ).resolves.not.toThrow();
    await expect(
      fs.access(path.join(assetsRoot, asset.thumbnails.large.path))
    ).resolves.not.toThrow();
  });
});
```

### Performance Tests

**Measure thumbnail generation overhead**:

```typescript
// tools/load-tests/thumbnail-generation-benchmark.ts

import { performance } from 'perf_hooks';
import { SharpThumbnailGenerator } from '../apps/node/src/infra/images/sharp-thumbnail-generator';
import fs from 'fs/promises';

async function benchmarkThumbnailGeneration() {
  const generator = new SharpThumbnailGenerator();
  const testImage = await fs.readFile('./test-files/large-photo.jpg'); // e.g., 5MB

  console.log(`Source image size: ${(testImage.length / 1024 / 1024).toFixed(2)} MB`);

  const sizes = [
    { name: 'small', width: 150, height: 150 },
    { name: 'medium', width: 400, height: 400 },
    { name: 'large', width: 800, height: 800 },
  ];

  for (const size of sizes) {
    const start = performance.now();

    const thumbnail = await generator.generate(testImage, {
      ...size,
      quality: 85,
      format: 'webp',
    });

    const duration = performance.now() - start;
    const reduction = ((1 - thumbnail.size / testImage.length) * 100).toFixed(1);

    console.log(
      `${size.name} (${size.width}px): ${duration.toFixed(0)}ms, ${(thumbnail.size / 1024).toFixed(0)}KB (-${reduction}%)`
    );
  }
}

// Expected output:
// Source image size: 5.23 MB
// small (150px): 45ms, 8KB (-99.8%)
// medium (400px): 120ms, 35KB (-99.3%)
// large (800px): 280ms, 120KB (-97.7%)
```

---

## Troubleshooting

### Issue 1: Thumbnail Generation Slow (> 500ms per image)

**Symptoms**:

- Asset upload takes significantly longer with thumbnails enabled
- Plugin shows "Generating thumbnails..." for extended periods
- Upload times 3-5x slower than without thumbnails

**Root Causes**:

1. **Large source images** (> 10MB)
2. **Too many thumbnail sizes** (generating more than needed)
3. **Sequential processing** (not using concurrency)
4. **CPU-bound server** (shared hosting, low CPU allocation)

**Resolution**:

```bash
# 1. Reduce source image size limit
MAX_ASSET_SIZE_BYTES=5242880  # 5MB instead of 10MB

# 2. Generate only needed sizes
THUMBNAIL_SIZES=small,medium  # Skip 'large' if not used

# 3. Increase concurrency (if CPU allows)
THUMBNAIL_CONCURRENCY=8  # From default 4

# 4. Optimize sharp settings (reduce quality slightly)
THUMBNAIL_QUALITY=75  # From default 85 (30% faster, minimal visual difference)
```

**Code optimization** (parallel generation):

```typescript
// Generate all thumbnail sizes in parallel instead of sequentially
const thumbnailPromises = sizes.map(async ({ key, config }) => {
  const thumbnail = await this.thumbnailGenerator.generate(imageBuffer, config);
  return { key, thumbnail, path: this.buildThumbnailPath(originalPath, key, config.format) };
});

const results = await Promise.all(thumbnailPromises);

for (const { key, thumbnail, path } of results) {
  result[key] = {
    path,
    size: thumbnail.size,
    width: thumbnail.width,
    height: thumbnail.height,
  };
}
```

---

### Issue 2: Thumbnails Missing from Manifest After Upload

**Symptoms**:

- Assets uploaded successfully
- Original images visible on site
- Manifest `thumbnails` field is `undefined` or empty
- Server logs show "Thumbnail generation failed"

**Root Causes**:

1. **sharp library not installed** (native binaries missing)
2. **Unsupported image format** (e.g., HEIC, BMP)
3. **Corrupted image** (invalid file structure)
4. **Permission error** (can't write thumbnail files)

**Resolution**:

```bash
# 1. Verify sharp is installed and working
node -e "const sharp = require('sharp'); console.log(sharp.versions)"
# Expected output: { vips: '8.x.x', sharp: '0.33.0' }

# 2. Check server logs for specific error
docker logs obsidian-vps-publish-app | grep "Thumbnail generation failed"

# Example error: "Input file has unsupported format"
# Solution: Convert HEIC to JPEG before upload (plugin-side preprocessing)

# 3. Test thumbnail generation manually
node -e "
const sharp = require('sharp');
const fs = require('fs');
const buffer = fs.readFileSync('./test-image.jpg');
sharp(buffer).resize(150, 150).toFile('./thumb.webp').then(console.log);
"

# 4. Check file permissions
ls -la /assets/_assets/
# Should show writable directory for app user
```

**Docker Fix** (if sharp not working):

```dockerfile
# Dockerfile - Ensure sharp dependencies installed

FROM node:20-alpine AS builder

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    vips-dev \
    vips-tools  # Add missing vips tools

# Rebuild sharp after adding dependencies
RUN npm rebuild sharp
```

---

### Issue 3: High Storage Usage from Thumbnails

**Symptoms**:

- Storage usage 30-50% higher than expected
- Thumbnails consuming more space than justified by performance benefit
- Cost concerns for cloud storage (S3, DigitalOcean Spaces)

**Root Causes**:

1. **Too many thumbnail sizes** generated per image
2. **WebP compression not effective** (quality too high)
3. **Thumbnails generated for small images** (no benefit)

**Resolution**:

```bash
# 1. Audit thumbnail usage
# Check which sizes are actually used by frontend
grep -r "getThumbnailUrl.*'small'" apps/site/src/
# If 'large' never used, disable it:
THUMBNAIL_SIZES=small,medium

# 2. Reduce quality (minimal visual impact, 30-40% size reduction)
THUMBNAIL_QUALITY=75  # From 85

# 3. Skip thumbnails for small images (< 200KB)
THUMBNAIL_MAX_SOURCE_SIZE=204800  # 200KB
# Implementation: Check asset.data.length before generating thumbnails

# 4. Use progressive JPEG instead of WebP (better compression for photos)
THUMBNAIL_FORMAT=jpeg  # Try both, measure which is smaller
```

**Storage analysis script**:

```bash
#!/bin/bash
# analyze-thumbnail-storage.sh

ASSETS_DIR="/path/to/assets/_assets"

ORIGINALS_SIZE=$(find "$ASSETS_DIR" -type f ! -name '*_thumb-*' -exec du -cb {} + | tail -1 | cut -f1)
THUMBS_SIZE=$(find "$ASSETS_DIR" -type f -name '*_thumb-*' -exec du -cb {} + | tail -1 | cut -f1)

echo "Originals: $(numfmt --to=iec $ORIGINALS_SIZE)"
echo "Thumbnails: $(numfmt --to=iec $THUMBS_SIZE)"
echo "Overhead: $(( THUMBS_SIZE * 100 / ORIGINALS_SIZE ))%"
```

---

### Issue 4: CDN Cache Contains Stale Thumbnails

**Symptoms**:

- Updated image in Obsidian, but old thumbnail still shows on site
- Original image updated correctly, only thumbnail is stale
- Hard refresh in browser doesn't fix (CDN-level caching)

**Root Causes**:

1. **Thumbnail path unchanged** (same filename after regeneration)
2. **CDN purge didn't include thumbnails**
3. **Immutable cache headers** on thumbnails (1-year TTL)

**Resolution**:

**Option A**: Include content hash in thumbnail filename (recommended)

```typescript
// Thumbnail path: {originalName}_{contentHash}_thumb-{size}.webp
// Example: diagram-abc123_thumb-sm.webp

private buildThumbnailPath(originalPath: string, contentHash: string, size: string, format: string): string {
  const ext = path.extname(originalPath);
  const base = path.basename(originalPath, ext);
  const dir = path.dirname(originalPath);
  return path.join(dir, `${base}_${contentHash.slice(0, 8)}_thumb-${size}.${format}`);
}
```

Benefits:

- Changing image content → new hash → new thumbnail URL → CDN fetches new version
- Old thumbnails automatically cleaned up during selective promotion (not in manifest)

**Option B**: Purge thumbnails explicitly when purging assets

```bash
# Cloudflare purge (include thumbnail patterns)
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "files": [
      "https://notes.example.com/assets/_assets/diagram.png",
      "https://notes.example.com/assets/_assets/diagram_thumb-sm.webp",
      "https://notes.example.com/assets/_assets/diagram_thumb-md.webp",
      "https://notes.example.com/assets/_assets/diagram_thumb-lg.webp"
    ]
  }'
```

**Option C**: Shorter cache for thumbnails (not recommended, defeats immutability)

```typescript
// apps/node/src/infra/http/express/app.ts

app.use(
  '/assets',
  express.static(ASSETS_ROOT, {
    setHeaders: (res, filePath) => {
      if (filePath.includes('_thumb-')) {
        // Shorter cache for thumbnails
        res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate'); // 1 day
      } else {
        // Immutable cache for originals
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
      }
    },
  })
);
```

---

## Performance Impact

### Expected Metrics

**Upload Time Impact**:

- **Without thumbnails**: ~100ms per image (validation + save)
- **With thumbnails (sequential)**: ~800ms per image (+700ms for 3 sizes)
- **With thumbnails (parallel)**: ~400ms per image (+300ms, 3x concurrency)

**Storage Impact**:

- **Original images**: 100% (baseline)
- **Thumbnails (WebP, quality 85)**: +15-25% total storage
- **Example**: 1GB original images → 1.2GB with thumbnails

**Page Load Impact** (savings):

- **Gallery with 50 images**:
  - Before (full-size): 250MB total, 15s load time (slow 3G)
  - After (medium thumbs): 5MB total, 2s load time (86% faster)
- **List view with 100 items**:
  - Before: 200MB, not practical
  - After (small thumbs): 800KB, instant load

**CDN Cost Impact**:

- **Bandwidth reduction**: 80-95% for gallery/list views (thumbnails vs. originals)
- **Storage cost increase**: 15-25% (thumbnails stored)
- **Net savings**: Significant for high-traffic sites (bandwidth > storage cost)

---

## Migration Strategy

### Phase 1: Implementation (Non-Breaking)

1. **Add thumbnail generation** to `UploadAssetsHandler` (feature flag disabled by default)
2. **Extend manifest interface** (thumbnails optional, backward compatible)
3. **Deploy backend** with `THUMBNAILS_ENABLED=false`
4. **Test manually** with single test vault

### Phase 2: Opt-In Testing

1. **Enable for test account**: `THUMBNAILS_ENABLED=true`
2. **Publish test content** from plugin
3. **Verify thumbnails** in manifest and storage
4. **Measure performance**: Upload time, storage usage
5. **Monitor errors**: Check logs for generation failures

### Phase 3: Frontend Update

1. **Update Angular components** to use `getThumbnailUrl()` helper
2. **Implement progressive loading**: Thumbnail → original on click
3. **Add lazy loading**: `loading="lazy"` for off-screen images
4. **Deploy site** (backward compatible, falls back to original if no thumbnails)

### Phase 4: Gradual Rollout

1. **Enable for 10% of users** (feature flag)
2. **Monitor metrics**: Error rate, performance, user feedback
3. **Gradually increase** to 50%, then 100%
4. **Set as default**: `THUMBNAILS_ENABLED=true`

### Phase 5: Historical Content

1. **Create migration script** to generate thumbnails for existing assets:

```bash
#!/bin/bash
# scripts/generate-thumbnails-for-existing-assets.sh

API_URL="https://notes.example.com"
API_KEY="your-api-key"

# Trigger thumbnail regeneration endpoint (to be implemented)
curl -X POST "$API_URL/api/admin/regenerate-thumbnails" \
  -H "x-api-key: $API_KEY" \
  -d '{"dryRun": false}'
```

2. **Run during maintenance window** (CPU-intensive)
3. **Update manifest** with new thumbnail references
4. **Purge CDN cache** to fetch new thumbnails

---

## References

### Libraries & Tools

- **[sharp](https://sharp.pixelplumbing.com/)** - High-performance image processing for Node.js (recommended)
- **[jimp](https://github.com/oliver-moran/jimp)** - Pure JavaScript alternative (slower, no native dependencies)
- **[thumbor](https://www.thumbor.org/)** - Standalone image processing service (overkill for this project)

### Best Practices

- **[Google Web Fundamentals: Images](https://developers.google.com/web/fundamentals/design-and-ux/responsive/images)** - Responsive image patterns
- **[Web.dev: Optimize Images](https://web.dev/fast/#optimize-your-images)** - Image optimization guide
- **[Can I Use WebP](https://caniuse.com/webp)** - Browser support for WebP (95%+ as of 2026)

### Related Documentation

- **[Asset Deduplication](./asset-deduplication.md)** - How asset hashing enables cache-friendly thumbnail naming
- **[CDN Deployment](./cdn-deployment.md)** - Cache strategies for thumbnails vs. originals
- **[Asset Security](./asset-security.md)** - Size limits and validation apply to source images (not thumbnails)
- **[Performance](./performance.md)** - Thumbnail impact on upload and serving performance

### Code Examples

- **Sharp thumbnail generation**: [SharpThumbnailGenerator implementation](#3-infrastructure-layer-appsnodessrcinfra) (above)
- **Frontend integration**: [Angular image component](#frontend-integration-site-angular-app) (above)
- **Test coverage**: [Unit and integration tests](#testing-strategy) (above)

---

**Document Status**:
✅ **Design Complete** - Ready for implementation when prioritized  
⏳ **Implementation**: Not started (LOW priority)  
📅 **Target**: Q3 2026 or when user demand justifies

**Complexity**: 🔴 **High** (new dependency, native binaries, storage changes, frontend updates)

**Estimated Effort**: 2-3 days (implementation + testing + deployment)
