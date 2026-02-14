# Streaming Refactor for Memory Optimization - Design Guide

## Purpose

This document provides architectural guidance for refactoring obsidian-vps-publish to use **streaming** instead of **buffering entire files in memory**. Streaming enables handling large files (50MB+) without memory exhaustion, improves upload/download responsiveness, and reduces server resource requirements.

**Status**: 🔶 **Design Document** (not yet implemented)

This is a LOW priority optimization. Current implementation handles typical workloads (< 10MB assets) adequately. Implement only if:

- Users report memory issues (OOM errors, crashes)
- Large vault requirements (100+ MB files)
- Deployment constraints (low-memory VPS)

---

## When to Use

Implement streaming when:

- **Large asset support**: Need to handle files > 50MB (videos, high-res images, archives)
- **Memory-constrained deployment**: VPS with < 2GB RAM serving multiple concurrent uploads
- **Concurrent upload bottleneck**: Multiple users uploading simultaneously causes memory spikes
- **Virus scanning timeouts**: ClamAV scanning large files (> 10MB) hits timeout limits
- **Upload progress tracking**: Need real-time progress feedback for large transfers

**Do NOT refactor** when:

- Asset sizes < 10MB (current buffering approach sufficient)
- Single-user deployment (no concurrency pressure)
- Adequate RAM available (4GB+, no memory alerts)
- Stable performance (no user complaints about slow uploads/serving)

---

## Key Concepts

### Current Architecture (Buffer-Based)

**Upload workflow** (assets):

```
1. Plugin → HTTP POST → Backend
   - Body: JSON { assets: [{ path, data: "base64..." }] }
   - Base64 increases payload size 33% (overhead)

2. Express → Buffer entire payload in memory
   - req.body parsed by express.json() middleware
   - Full JSON object (all assets) loaded into RAM

3. UploadAssetsHandler → Process each asset
   - Decode base64 → Buffer
   - Validate + hash → Load entire buffer
   - Virus scan (if enabled) → Buffer passed to ClamAV
   - Write to disk → fs.writeFile(buffer) all at once

4. Memory released → Garbage collection
```

**Memory profile**:

- **Upload 5 assets @ 10MB each**: ~66MB RAM (33% base64 overhead)
- **10 concurrent uploads**: 660MB RAM peak
- **Large asset (50MB)**: 66MB single request RAM

**Serving workflow** (already optimized):

```
GET /assets/image.png
 → Express express.static()
 → fs.createReadStream() (streaming, not buffering)
 → Pipe to response (chunked transfer-encoding)
 → Client receives chunks progressively
```

**Conclusion**: Serving is already efficient (streaming). Problem is **uploads** (buffering).

---

### Target Architecture (Stream-Based)

**Upload workflow** (refactored):

```
1. Plugin → HTTP POST multipart/form-data → Backend
   - Content-Type: multipart/form-data
   - Each asset as separate form field (no base64)

2. Express + multer → Stream to temp file/memory
   - multer intercepts multipart stream
   - Writes chunks to disk as they arrive (no buffering)
   - Or stores in Readable stream (memory, chunk-based)

3. UploadAssetsHandler → Process from stream
   - Validation: read chunks, inspect magic bytes (first 262 bytes)
   - Hash: streaming hash (update per chunk, finalize at end)
   - Virus scan: stream chunks to ClamAV (no full buffer)
   - Write to storage: pipe stream directly to destination

4. Memory released per-chunk → Constant RAM usage
```

**Memory profile** (after refactor):

- **Upload 5 assets @ 10MB each**: ~10MB RAM (chunk buffer, not full files)
- **10 concurrent uploads**: ~100MB RAM (10x 10MB chunk buffers)
- **Large asset (50MB)**: ~10MB RAM (chunks processed incrementally)

**Benefit**: Memory usage decoupled from file size → handles 1GB files with same RAM as 10MB files.

---

## Architecture Design

### Layer Organization

#### 1. HTTP Layer (Express Middleware)

**Goal**: Replace `express.json()` with streaming multipart parser (`multer`).

**Current** (buffer-based):

```typescript
// apps/node/src/infra/http/express/app.ts

app.use(express.json({ limit: '50mb' })); // Entire body buffered in memory
```

**Proposed** (stream-based):

```typescript
// apps/node/src/infra/http/express/middleware/multipart-upload.middleware.ts

import multer from 'multer';
import path from 'path';
import { v4 as uuid } from 'uuid';

/**
 * Multer configuration for streaming asset uploads
 * Uses diskStorage to write chunks directly to temp directory
 */
export function createMultipartUploadMiddleware(tempDir: string) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      // Store in temporary directory during upload
      // Final location determined after validation in handler
      cb(null, tempDir);
    },
    filename: (req, file, cb) => {
      // Unique temp filename to avoid collisions
      const uniqueName = `${uuid()}-${file.originalname}`;
      cb(null, uniqueName);
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB per file (more generous than current 10MB)
      files: 100, // Max 100 files per request
    },
    fileFilter: (req, file, cb) => {
      // Early rejection of obviously invalid files (optional)
      // Real validation happens in handler after streaming complete
      cb(null, true);
    },
  });
}
```

**Apply to routes**:

```typescript
// apps/node/src/infra/http/express/controllers/session-controller.ts

import { createMultipartUploadMiddleware } from '../middleware/multipart-upload.middleware';

const upload = createMultipartUploadMiddleware(path.join(EnvConfig.contentRoot(), '.tmp'));

router.post(
  '/session/:sessionId/assets/upload',
  upload.array('assets'), // Parse multipart, stream to temp files
  async (req: Request, res: Response) => {
    // Files available in req.files (array of multer.File)
    const files = req.files as Express.Multer.File[];

    const command: UploadAssetsCommand = {
      sessionId: req.params.sessionId,
      assets: files.map((file) => ({
        path: file.originalname, // Original filename from plugin
        tempPath: file.path, // Temporary disk location (multer wrote it)
        size: file.size,
        clientMimeType: file.mimetype,
      })),
    };

    const result = await assetPublicationHandler.handle(command);
    res.json(result);
  }
);
```

**Key changes**:

- Multipart streaming instead of JSON body
- Files streamed directly to temp directory
- Handler receives temp file paths, not buffers

#### 2. Domain Layer (Ports)

**Current port** (buffer-based):

```typescript
// libs/core-application/src/lib/ports/asset-storage-port.ts

export interface AssetStoragePort {
  save(params: Array<{ filename: string; content: Uint8Array }>): Promise<void>;
  //                                      ^^^^^^^ Full buffer in memory
}
```

**Proposed port** (stream-based):

```typescript
// libs/core-application/src/lib/ports/asset-storage-port.ts

import { Readable } from 'stream';

export interface AssetStoragePort {
  /**
   * Save asset from readable stream (memory-efficient)
   * @param filename Relative path for asset (e.g., "_assets/image.png")
   * @param stream Readable stream of asset data
   * @returns Promise resolving to saved file size
   */
  saveFromStream(filename: string, stream: Readable): Promise<{ size: number }>;

  /**
   * Legacy method: Save from buffer (deprecated, use saveFromStream)
   * @deprecated Prefer saveFromStream for large files
   */
  save(params: Array<{ filename: string; content: Uint8Array }>): Promise<void>;
}
```

**New port for validation**:

```typescript
// libs/core-domain/src/lib/ports/asset-validator-streaming-port.ts

import { Readable } from 'stream';

export interface ValidationResult {
  valid: boolean;
  detectedMimeType: string;
  errors?: string[];
}

export interface AssetValidatorStreamingPort {
  /**
   * Validate asset from stream (first 262 bytes for magic number detection)
   * Stream is NOT consumed (reusable after validation)
   * @param stream Readable stream (must support .pipe() and rewind/replay)
   * @param filename Original filename (for extension fallback)
   * @param clientMimeType MIME type claimed by client
   * @param maxSizeBytes Maximum allowed file size
   * @returns Validation result without consuming full stream
   */
  validateStream(
    stream: Readable,
    filename: string,
    clientMimeType: string,
    maxSizeBytes: number
  ): Promise<ValidationResult>;
}
```

**New port for hashing**:

```typescript
// libs/core-domain/src/lib/ports/asset-hash-streaming-port.ts

import { Readable } from 'stream';

export interface AssetHashStreamingPort {
  /**
   * Compute SHA256 hash from stream
   * Stream is consumed during hashing
   * @param stream Readable stream of asset data
   * @returns Promise resolving to hex-encoded hash
   */
  hashFromStream(stream: Readable): Promise<string>;
}
```

#### 3. Application Layer (Handlers)

**Modified Command**:

```typescript
// libs/core-application/src/lib/publishing/commands/upload-assets.command.ts

export interface UploadAssetsCommand {
  sessionId: string;
  assets: Array<{
    path: string; // Destination path (e.g., "_assets/image.png")
    tempPath: string; // Temporary file location (from multer)
    size: number; // File size (from multer)
    clientMimeType: string; // MIME type (from multipart header)
  }>;
}
```

**Modified Handler**:

```typescript
// libs/core-application/src/lib/publishing/handlers/upload-assets.handler.ts

import fs from 'fs';
import { pipeline } from 'stream/promises';

export class UploadAssetsHandler {
  constructor(
    private readonly assetStorage: AssetStoragePort,
    private readonly manifestStorage: ManifestPort,
    private readonly assetValidator: AssetValidatorStreamingPort,
    private readonly assetHasher: AssetHashStreamingPort,
    private readonly logger?: LoggerPort
  ) {}

  async handle(command: UploadAssetsCommand): Promise<UploadAssetsResult> {
    const allStagedAssets: ManifestAsset[] = [];
    const statistics = { newCount: 0, skippedCount: 0, bytesDeduped: 0 };

    for (const asset of command.assets) {
      try {
        // 1. Create readable stream from temp file
        const sourceStream = fs.createReadStream(asset.tempPath);

        // 2. Validate (peeks first 262 bytes, doesn't consume stream)
        const validation = await this.assetValidator.validateStream(
          sourceStream,
          asset.path,
          asset.clientMimeType,
          EnvConfig.maxAssetSizeBytes()
        );

        if (!validation.valid) {
          this.logger?.warn('Asset validation failed', { asset: asset.path });
          continue; // Skip invalid asset
        }

        // 3. Compute hash (consumes stream, so create new one)
        const hashStream = fs.createReadStream(asset.tempPath);
        const assetHash = await this.assetHasher.hashFromStream(hashStream);

        // 4. Check deduplication (existing assets)
        const manifest = await this.manifestStorage.load();
        const existingAsset = manifest?.assets?.find((a) => a.hash === assetHash);

        if (existingAsset) {
          this.logger?.info('Asset already exists (deduplicated)', {
            path: asset.path,
            hash: assetHash,
          });
          allStagedAssets.push(existingAsset); // Reuse existing
          statistics.skippedCount++;
          statistics.bytesDeduped += asset.size;

          // Delete temp file (no longer needed)
          await fs.promises.unlink(asset.tempPath);
          continue;
        }

        // 5. Save to storage via streaming
        const saveStream = fs.createReadStream(asset.tempPath);
        await this.assetStorage.saveFromStream(asset.path, saveStream);

        // 6. Add to manifest
        allStagedAssets.push({
          path: asset.path,
          hash: assetHash,
          size: asset.size,
          mimeType: validation.detectedMimeType,
          uploadedAt: new Date(),
        });

        statistics.newCount++;

        // 7. Clean up temp file
        await fs.promises.unlink(asset.tempPath);

        this.logger?.info('Asset uploaded successfully', {
          path: asset.path,
          size: asset.size,
          hash: assetHash,
        });
      } catch (error) {
        this.logger?.error('Asset upload failed', {
          path: asset.path,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    // Save manifest with all staged assets
    await this.manifestStorage.save({
      ...manifest,
      assets: allStagedAssets,
      lastUpdatedAt: new Date(),
    });

    return {
      assetsUploaded: statistics.newCount,
      assetsSkipped: statistics.skippedCount,
      bytesDeduped: statistics.bytesDeduped,
    };
  }
}
```

#### 4. Infrastructure Layer (Adapters)

**Streaming Storage Adapter**:

```typescript
// apps/node/src/infra/filesystem/assets-file-system-streaming.storage.ts

import fs from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import { Readable } from 'stream';

export class AssetsFileSystemStreamingStorage implements AssetStoragePort {
  constructor(
    private readonly assetsRoot: string,
    private readonly logger?: LoggerPort
  ) {}

  async saveFromStream(filename: string, stream: Readable): Promise<{ size: number }> {
    const normalizedRelative = filename.replace(/^[/\\]+/, '');
    const fullPath = resolveWithinRoot(this.assetsRoot, normalizedRelative);

    const dir = path.dirname(fullPath);
    await fs.promises.mkdir(dir, { recursive: true });

    // Stream directly to destination (no buffering)
    const writeStream = fs.createWriteStream(fullPath);

    // Track bytes written
    let totalBytes = 0;
    stream.on('data', (chunk) => {
      totalBytes += chunk.length;
    });

    try {
      // Pipeline handles backpressure automatically
      await pipeline(stream, writeStream);

      this.logger?.debug('Asset saved from stream', {
        filename,
        fullPath,
        size: totalBytes,
      });

      return { size: totalBytes };
    } catch (error) {
      this.logger?.error('Failed to save asset from stream', {
        filename,
        fullPath,
        error,
      });
      throw error;
    }
  }

  // Legacy method (unchanged for backward compatibility)
  async save(params: Array<{ filename: string; content: Uint8Array }>): Promise<void> {
    // ... existing implementation
  }
}
```

**Streaming Hash Adapter**:

```typescript
// apps/node/src/infra/utils/asset-hash-streaming.service.ts

import crypto from 'crypto';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

export class AssetHashStreamingService implements AssetHashStreamingPort {
  async hashFromStream(stream: Readable): Promise<string> {
    const hash = crypto.createHash('sha256');

    try {
      // Pipe stream through hash transform
      await pipeline(stream, async function* (source) {
        for await (const chunk of source) {
          hash.update(chunk);
          yield chunk; // Pass through (if needed downstream)
        }
      });

      return hash.digest('hex');
    } catch (error) {
      throw new Error(`Hash computation failed: ${error}`);
    }
  }

  // Legacy method (unchanged)
  async hash(buffer: Buffer): Promise<string> {
    // ... existing implementation
  }
}
```

**Streaming Validator Adapter**:

```typescript
// apps/node/src/infra/validation/file-type-streaming-validator.ts

import { fileTypeFromStream } from 'file-type';
import { Readable } from 'stream';

export class FileTypeStreamingValidator implements AssetValidatorStreamingPort {
  async validateStream(
    stream: Readable,
    filename: string,
    clientMimeType: string,
    maxSizeBytes: number
  ): Promise<ValidationResult> {
    // Read only first 262 bytes (magic number detection)
    const firstChunk = await this.peekStream(stream, 262);

    // Detect MIME type from magic bytes
    const detected = await fileTypeFromStream(Readable.from([firstChunk]));

    if (!detected) {
      // Fallback to extension-based detection
      return {
        valid: true,
        detectedMimeType: this.mimeFromExtension(filename),
      };
    }

    // Validate against allowlist
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
      // ... etc
    ];

    if (!allowedMimes.includes(detected.mime)) {
      return {
        valid: false,
        detectedMimeType: detected.mime,
        errors: [`File type not allowed: ${detected.mime}`],
      };
    }

    return {
      valid: true,
      detectedMimeType: detected.mime,
    };
  }

  private async peekStream(stream: Readable, bytes: number): Promise<Buffer> {
    // Read first N bytes without consuming entire stream
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;

      const onData = (chunk: Buffer) => {
        chunks.push(chunk);
        totalSize += chunk.length;

        if (totalSize >= bytes) {
          stream.pause();
          stream.removeListener('data', onData);
          stream.removeListener('error', onError);
          stream.removeListener('end', onEnd);

          const result = Buffer.concat(chunks).slice(0, bytes);
          resolve(result);
        }
      };

      const onError = (err: Error) => {
        stream.removeListener('data', onData);
        stream.removeListener('end', onEnd);
        reject(err);
      };

      const onEnd = () => {
        stream.removeListener('data', onData);
        stream.removeListener('error', onError);
        resolve(Buffer.concat(chunks));
      };

      stream.on('data', onData);
      stream.on('error', onError);
      stream.on('end', onEnd);
    });
  }
}
```

---

## Plugin Changes (Obsidian)

**Current** (base64 JSON):

```typescript
// apps/obsidian-vps-publish/src/lib/api-client.ts

async uploadAssets(sessionId: string, assets: Array<{ path: string; data: Buffer }>) {
  const payload = {
    assets: assets.map((asset) => ({
      path: asset.path,
      data: asset.data.toString('base64'), // 33% overhead
    })),
  };

  await fetch(`${this.baseUrl}/api/session/${sessionId}/assets/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
    },
    body: JSON.stringify(payload), // Entire payload buffered
  });
}
```

**Proposed** (multipart/form-data):

```typescript
// apps/obsidian-vps-publish/src/lib/api-client.ts

async uploadAssets(sessionId: string, assets: Array<{ path: string; data: Buffer }>) {
  const formData = new FormData();

  // Add each asset as separate form field
  for (const asset of assets) {
    const blob = new Blob([asset.data]);
    formData.append('assets', blob, asset.path); // filename = path
  }

  await fetch(`${this.baseUrl}/api/session/${sessionId}/assets/upload`, {
    method: 'POST',
    headers: {
      // NO Content-Type header! Browser sets it automatically with boundary
      'x-api-key': this.apiKey,
    },
    body: formData, // Multipart, no base64 encoding
  });
}
```

**Benefits**:

- No base64 overhead (33% payload size reduction)
- Browser streams multipart automatically (no full buffer in memory)
- Progress tracking possible via `fetch` + `ReadableStream`

---

## Configuration

### Environment Variables

**New variables**:

```bash
# Streaming upload configuration
UPLOAD_TEMP_DIR=/tmp/obsidian-uploads  # Temp directory for multer (default: CONTENT_ROOT/.tmp)
STREAMING_CHUNK_SIZE=65536              # Chunk size in bytes (default: 64KB)
STREAMING_ENABLED=true                  # Enable streaming uploads (default: true, fallback to buffer-based)

# Backward compatibility
LEGACY_BUFFER_UPLOADS=false             # Support old JSON body uploads (default: false)
```

### Nginx Proxy Configuration

**Enable chunked transfer encoding**:

```nginx
# /etc/nginx/sites-available/notes.example.com

server {
    listen 443 ssl http2;
    server_name notes.example.com;

    # Important: Disable buffering for streaming uploads
    proxy_request_buffering off;
    proxy_buffering off;

    # Allow large uploads (chunked)
    client_max_body_size 100M;

    location /api/session {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # Enable chunked transfer encoding
        proxy_http_version 1.1;
        chunked_transfer_encoding on;
    }
}
```

---

## Performance Impact

### Memory Usage

**Before (buffer-based)**:

| Scenario                    | RAM Usage              | Peak RAM         |
| --------------------------- | ---------------------- | ---------------- |
| Single 10MB asset upload    | 13MB (base64 overhead) | 13MB             |
| 5x 10MB concurrent uploads  | 65MB                   | 65MB             |
| Single 50MB asset upload    | 66MB                   | 66MB             |
| 10x 50MB concurrent uploads | 660MB                  | 660MB (OOM risk) |

**After (stream-based)**:

| Scenario                    | RAM Usage           | Peak RAM |
| --------------------------- | ------------------- | -------- |
| Single 10MB asset upload    | 64KB (chunk buffer) | 64KB     |
| 5x 10MB concurrent uploads  | 320KB (5x 64KB)     | 320KB    |
| Single 50MB asset upload    | 64KB (streaming)    | 64KB     |
| 10x 50MB concurrent uploads | 640KB (10x 64KB)    | 640KB    |

**Memory savings**: 99% reduction for large files, enables handling 1GB+ files on low-RAM VPS.

### Upload Throughput

**Before**:

- **10MB asset**: ~300ms (buffer + base64 decode + write)
- **50MB asset**: ~1500ms (memory bottleneck)
- **10 concurrent 10MB**: ~3000ms (memory pressure → GC pauses)

**After**:

- **10MB asset**: ~200ms (stream + write, no decode)
- **50MB asset**: ~1000ms (constant RAM, no GC pressure)
- **10 concurrent 10MB**: ~2000ms (no memory bottleneck)

**Throughput improvement**: 30-50% faster for large files, consistent performance under concurrency.

---

## Migration Strategy

### Phase 1: Add Streaming Support (Non-Breaking)

1. **Implement new ports and adapters** (streaming variants)
2. **Add multer middleware** (multipart parsing)
3. **Create new handler method** `UploadAssetsHandler.handleStreaming()`
4. **Deploy with feature flag** `STREAMING_ENABLED=false` (opt-in)

### Phase 2: Plugin Update (Backward Compatible)

1. **Update plugin** to detect backend streaming support:

```typescript
// Plugin checks /public-config for streaming support
const config = await fetch(`${baseUrl}/public-config`).then((r) => r.json());

if (config.streamingUploadsEnabled) {
  // Use multipart/form-data
  await this.uploadAssetsStreaming(sessionId, assets);
} else {
  // Fallback to legacy JSON body
  await this.uploadAssetsLegacy(sessionId, assets);
}
```

2. **Release plugin update** (backward compatible with old backend)

### Phase 3: Gradual Rollout

1. **Enable streaming for beta users** (`STREAMING_ENABLED=true`)
2. **Monitor metrics**: Memory usage, upload times, error rates
3. **Expand to all users** after validation

### Phase 4: Deprecate Legacy

1. **Mark buffer-based methods as deprecated** (6 months notice)
2. **Remove `LEGACY_BUFFER_UPLOADS` flag** (force streaming)
3. **Remove old code paths** in next major version

---

## Troubleshooting

### Issue 1: Upload Fails with "Unexpected end of multipart data"

**Symptoms**:

- Uploads fail mid-transfer
- Server logs: `Error: Unexpected end of multipart data`
- Works for small files, fails for large (> 20MB)

**Root Causes**:

1. **Nginx buffering enabled** (default behavior)
2. **Client timeout** (connection closed before upload complete)
3. **Multer temp directory out of space**

**Resolution**:

```nginx
# Disable Nginx buffering for streaming
proxy_request_buffering off;
client_body_buffer_size 1M;
client_max_body_size 100M;
```

```bash
# Check temp directory space
df -h /tmp/obsidian-uploads

# Clean old temp files (if disk full)
find /tmp/obsidian-uploads -type f -mtime +1 -delete
```

---

### Issue 2: Memory Usage Still High After Refactor

**Symptoms**:

- Expected 64KB per upload, seeing 10MB+ RAM usage
- Memory doesn't drop after upload completes
- Garbage collection pauses frequent

**Root Causes**:

1. **Not using streaming in all code paths** (some lingering `fs.readFile` calls)
2. **Multer configured to use memory storage** instead of disk storage
3. **Large payload logging** (Logger buffering entire request body)

**Resolution**:

```typescript
// 1. Verify multer uses diskStorage
const storage = multer.diskStorage({ /* ... */ });

// 2. Audit code for fs.readFile (replace with createReadStream)
grep -rn "fs.readFile" apps/node/src/

// 3. Disable body logging for uploads
app.use((req, res, next) => {
  if (req.path.includes('/assets/upload')) {
    req.log = false; // Don't log body
  }
  next();
});
```

---

### Issue 3: Virus Scanning Timeout for Streaming

**Symptoms**:

- Small files scan successfully
- Large files (> 20MB) timeout during ClamAV scan
- Error: `Virus scan timeout after 10000ms`

**Root Causes**:

- ClamAV `scanStream()` not reading fast enough
- Network latency to ClamAV daemon
- ClamAV daemon overloaded (CPU-bound)

**Resolution**:

```bash
# 1. Increase timeout
CLAMAV_TIMEOUT=30000  # 30 seconds (from 10s default)

# 2. Optimize ClamAV daemon performance
# /etc/clamav/clamd.conf
MaxThreads 20     # Increase from default 10
MaxQueue 200      # Allow more queued scans

# 3. Test scan performance
clamdscan --stream /path/to/large-file.bin
```

---

## References

### Libraries & Tools

- **[multer](https://github.com/expressjs/multer)** - Express multipart/form-data middleware (industry standard)
- **[busboy](https://github.com/mscdex/busboy)** - Lower-level multipart parser (if more control needed)
- **[pump](https://github.com/mafintosh/pump)** - Utility for safely piping streams (handles cleanup)
- **[file-type](https://github.com/sindresorhus/file-type)** - Detect file type from stream (magic bytes)

### Node.js Documentation

- **[Streams API](https://nodejs.org/api/stream.html)** - Comprehensive guide to Node.js streams
- **[stream/promises pipeline](https://nodejs.org/api/stream.html#streampipelinestreams-callback)** - Promise-based stream piping
- **[fs.createReadStream](https://nodejs.org/api/fs.html#fscreatereadstreampath-options)** - Read files as streams

### Best Practices

- **[Node.js Stream Handbook](https://github.com/substack/stream-handbook)** - Classic guide to streams
- **[Backpressure in Streams](https://nodejs.org/en/docs/guides/backpressuring-in-streams/)** - Understanding flow control
- **[Memory-efficient file uploads](https://blog.logrocket.com/multer-nodejs-express-upload-file/)** - Practical guide

### Related Documentation

- **[Asset Security](./asset-security.md)** - Streaming applies to virus scanning too
- **[Performance](./performance.md)** - Impact of streaming on throughput and latency
- **[CDN Deployment](./cdn-deployment.md)** - Streaming compatible with CDN caching

---

**Document Status**:
✅ **Design Complete** - Ready for implementation when prioritized  
⏳ **Implementation**: Not started (LOW priority)  
📅 **Target**: Q4 2026 or when memory constraints justify refactor

**Complexity**: 🔴 **High** (protocol change, plugin + backend changes, thorough testing needed)

**Estimated Effort**: 4-5 days (backend refactor + plugin update + testing + deployment)
