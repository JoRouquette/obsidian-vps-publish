# Asset Security

## Purpose

The asset security system protects the backend from malicious file uploads through three layers of validation:

1. **MIME Type Detection** - Prevents MIME spoofing attacks by detecting real file types from magic bytes
2. **Size Limits** - Rejects oversized files before processing to prevent denial-of-service
3. **Malware Scanning** - Optional virus detection via ClamAV integration

This prevents:

- Executable files disguised as images
- Malware/virus upload and distribution
- Storage exhaustion from oversized files
- Client-side MIME spoofing bypassing security checks

## When to Use

**MIME detection and size limits** are always enabled by default in production.

**Malware scanning** should be enabled when:

- Accepting uploads from untrusted sources
- Hosting in environments where virus detection is required (enterprise, regulated industries)
- Running a public-facing site with user-generated content
- Deploying behind a VPS/server with ClamAV installed

**Skip malware scanning** in:

- Local development (unless testing the scanner itself)
- Docker environments without ClamAV daemon
- CI/CD pipelines where virus scanning slows builds
- Trusted, single-user deployments (personal vault publishing)

## Key Concepts

### Architecture (Clean Architecture)

The asset security system follows **Ports & Adapters** pattern with dependency inversion:

**Domain Layer** (`libs/core-domain`):

- **`AssetValidatorPort`** - Interface for asset validation (MIME + size + scan)
- **`AssetScannerPort`** - Interface for virus scanning

**Infrastructure Layer** (`apps/node/src/infra`):

- **`FileTypeAssetValidator`** - Implements `AssetValidatorPort` with file-type library
- **`NoopAssetScanner`** - Default scanner (no-op, always returns clean)
- **`ClamAVAssetScanner`** - Real scanner (connects to ClamAV daemon via TCP)

### Validation Workflow

Assets are validated in this order (fail-fast approach):

```
1. Size check → Reject if > MAX_ASSET_SIZE_BYTES
2. MIME detection → Read magic bytes from buffer
3. MIME spoofing detection → Compare client vs detected type
4. Virus scan → Scan via ClamAV (if enabled)
```

If any step fails, the asset is **rejected** with a specific error:

- `AssetValidationError` - Size limit exceeded or invalid format
- `AssetScanError` - Virus detected by scanner

### MIME Detection

Uses **file-type** library (magic bytes detection):

- Reads first bytes of file (signature/header)
- Identifies real format (PNG, JPEG, PDF, etc.) regardless of extension
- Falls back to extension-based guess if magic bytes not recognized
- Defaults to `application/octet-stream` for unknown types

**Example**: Client sends `.jpg` file claiming `image/jpeg`, but magic bytes show `89 50 4E 47` (PNG signature) → Asset is accepted as `image/png`.

### Virus Scanning

**NoopAssetScanner** (default):

- Always returns `isClean: true`
- Used when `VIRUS_SCANNER_ENABLED=false`
- Logs scan requests but performs no actual scanning

**ClamAVAssetScanner**:

- Connects to ClamAV daemon (`clamd`) via TCP socket
- Converts buffer to stream and sends to `scanStream()` API
- Throws `AssetScanError` if virus detected
- Lazy initialization (connects on first scan, reuses connection)
- Fail-open approach: logs errors but doesn't block validation if scanner is misconfigured

### Error Handling

**Validation failures** (user-facing errors):

```typescript
throw new AssetValidationError('File size exceeds limit of 10MB', filename, 'SIZE_EXCEEDED');
```

**Virus detection** (security error):

```typescript
throw new AssetScanError('Virus detected: Win.Test.EICAR_HDB-1', filename, 'Win.Test.EICAR_HDB-1');
```

**Scanner misconfigured** (non-blocking):

- Logs error with `logger.error()`
- Continues validation (fail-open)
- Production deployments should monitor logs for scanner errors

## Configuration

### Environment Variables

**Size Limits**:

```bash
MAX_ASSET_SIZE_BYTES=10485760  # 10MB default (10 * 1024 * 1024)
```

**Virus Scanning**:

```bash
VIRUS_SCANNER_ENABLED=false     # Set to 'true' to enable ClamAV
CLAMAV_HOST=localhost           # ClamAV daemon hostname
CLAMAV_PORT=3310                # ClamAV daemon port (default clamd)
CLAMAV_TIMEOUT=10000            # Scan timeout in milliseconds
```

### Configuration Profiles

#### Development (local)

```bash
# .env.dev
VIRUS_SCANNER_ENABLED=false
MAX_ASSET_SIZE_BYTES=10485760
```

#### Production (Docker with ClamAV)

```bash
# .env.prod
VIRUS_SCANNER_ENABLED=true
CLAMAV_HOST=clamav              # Docker service name
CLAMAV_PORT=3310
CLAMAV_TIMEOUT=30000            # Allow time for large files
MAX_ASSET_SIZE_BYTES=52428800   # 50MB for production
```

#### Production (VPS with clamd service)

```bash
# .env.prod
VIRUS_SCANNER_ENABLED=true
CLAMAV_HOST=localhost
CLAMAV_PORT=3310
CLAMAV_TIMEOUT=10000
MAX_ASSET_SIZE_BYTES=20971520   # 20MB
```

### ClamAV Installation

**Docker Compose** (recommended):

```yaml
services:
  clamav:
    image: clamav/clamav:latest
    ports:
      - '3310:3310'
    volumes:
      - clamav-db:/var/lib/clamav
    environment:
      - CLAMAV_NO_FRESHCLAM=false # Auto-update virus definitions

  api:
    depends_on:
      - clamav
    environment:
      - VIRUS_SCANNER_ENABLED=true
      - CLAMAV_HOST=clamav
```

**Ubuntu/Debian VPS**:

```bash
sudo apt-get update
sudo apt-get install clamav-daemon clamav-freshclam

# Start daemon
sudo systemctl start clamav-daemon
sudo systemctl enable clamav-daemon

# Update virus definitions
sudo freshclam
```

**macOS (Homebrew)**:

```bash
brew install clamav

# Start daemon
brew services start clamav
```

## Usage

### Basic Upload Flow (with validation)

The validation is **automatically invoked** in the upload workflow:

1. Client calls `POST /api/session/:sessionId/assets/upload`
2. Backend receives multipart/form-data
3. For each asset:
   - Buffer is extracted
   - `FileTypeAssetValidator.validate()` is called
   - If validation passes, asset is saved to staging
   - If validation fails, error is logged and asset is skipped
4. Response includes `{ uploaded, errors }` with details

### Testing with EICAR Test File

The **EICAR test string** is a standard virus signature used for testing:

```bash
# Create EICAR test file
echo 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' > eicar.txt

# Try uploading (should be rejected if scanner enabled)
curl -X POST http://localhost:3000/api/session/abc123/assets/upload \
  -H "x-api-key: your-key" \
  -F "file=@eicar.txt"
```

Expected response with scanner enabled:

```json
{
  "sessionId": "abc123",
  "uploaded": 0,
  "errors": [
    {
      "assetName": "eicar.txt",
      "message": "Virus detected: Win.Test.EICAR_HDB-1"
    }
  ]
}
```

### Checking Scanner Status

Use logs to verify scanner initialization:

```bash
# Start backend with debug logging
LOGGER_LEVEL=debug npm run start node
```

Look for:

```
[DEBUG] Initializing ClamAV scanner { host: 'localhost', port: 3310 }
[INFO] ClamAV scanner initialized successfully
```

Or errors:

```
[ERROR] Failed to initialize ClamAV scanner { error: 'Connection refused' }
```

### Disabling Scanner (fallback to NoopScanner)

If ClamAV is unavailable, set `VIRUS_SCANNER_ENABLED=false`:

```bash
VIRUS_SCANNER_ENABLED=false npm run start node
```

Backend will use `NoopAssetScanner` which logs but doesn't scan:

```
[DEBUG] Skipping virus scan (NoopAssetScanner) { filename: 'image.png' }
```

## Troubleshooting

### Problem: "Failed to initialize ClamAV scanner"

**Cause**: ClamAV daemon not running or unreachable.

**Solutions**:

1. Check ClamAV is running:

   ```bash
   # Docker
   docker ps | grep clamav

   # Linux service
   sudo systemctl status clamav-daemon

   # macOS Homebrew
   brew services list | grep clamav
   ```

2. Test TCP connection:

   ```bash
   nc -zv localhost 3310
   # or
   telnet localhost 3310
   ```

3. Check ClamAV logs:

   ```bash
   # Docker
   docker logs <clamav-container>

   # Linux
   sudo journalctl -u clamav-daemon -f
   ```

4. Increase timeout if scanning large files:

   ```bash
   CLAMAV_TIMEOUT=30000
   ```

5. Fallback to NoopScanner:
   ```bash
   VIRUS_SCANNER_ENABLED=false
   ```

### Problem: "Asset rejected - size exceeds limit"

**Cause**: File larger than `MAX_ASSET_SIZE_BYTES`.

**Solutions**:

1. Increase limit (carefully):

   ```bash
   MAX_ASSET_SIZE_BYTES=52428800  # 50MB
   ```

2. Check actual file size:

   ```bash
   ls -lh /path/to/asset
   ```

3. Compress assets before upload (images, PDFs)

4. Use external CDN for very large files instead of self-hosted

### Problem: "MIME type mismatch" (logged as warning)

**Cause**: Client-provided MIME doesn't match detected MIME from magic bytes.

**Behavior**: Asset is **accepted** with detected MIME (not rejected).

**Example**:

- Client claims: `image/jpeg` (from file extension `.jpg`)
- Magic bytes detect: `image/png` (real PNG signature)
- Backend accepts as `image/png` and logs warning

**When to investigate**:

- Check if client is renaming files (`.png` → `.jpg`)
- Verify asset pipeline isn't corrupting files
- Some formats have ambiguous extensions (e.g., `.jpeg` vs `.jpg`)

### Problem: Virus scan timeout

**Cause**: Large files take too long to scan.

**Solutions**:

1. Increase `CLAMAV_TIMEOUT`:

   ```bash
   CLAMAV_TIMEOUT=60000  # 60 seconds
   ```

2. Reduce `MAX_ASSET_SIZE_BYTES` to reject large files earlier:

   ```bash
   MAX_ASSET_SIZE_BYTES=10485760  # 10MB
   ```

3. Check ClamAV configuration (multithreading, database freshness)

4. Monitor ClamAV resource usage (CPU, memory)

### Problem: Tests failing with "scanStream is not a function"

**Cause**: `@types/clamscan` not installed or outdated.

**Solution**:

```bash
npm install --save-dev @types/clamscan@2.4.1
```

### Problem: False positives (clean files rejected)

**Cause**: Outdated virus definitions or ClamAV configuration.

**Solutions**:

1. Update virus definitions:

   ```bash
   # Docker (restart container to pull latest)
   docker restart <clamav-container>

   # Linux
   sudo freshclam
   ```

2. Check ClamAV version and database date:

   ```bash
   clamscan --version
   ```

3. Whitelist specific file patterns (use with caution):
   - Modify ClamAV config to exclude certain signatures (advanced)

4. Report false positive to ClamAV community

## References

### Source Code

- **Domain Ports**: `libs/core-domain/src/lib/ports/`
  - [`asset-validator-port.ts`](../../libs/core-domain/src/lib/ports/asset-validator-port.ts)
  - [`asset-scanner-port.ts`](../../libs/core-domain/src/lib/ports/asset-scanner-port.ts)

- **Infrastructure**:
  - [`file-type-asset-validator.ts`](../../apps/node/src/infra/validation/file-type-asset-validator.ts)
  - [`noop-asset-scanner.ts`](../../apps/node/src/infra/security/noop-asset-scanner.ts)
  - [`clamav-asset-scanner.ts`](../../apps/node/src/infra/security/clamav-asset-scanner.ts)

- **Configuration**: [`env-config.ts`](../../apps/node/src/infra/config/env-config.ts)

- **DI Wiring**: [`app.ts`](../../apps/node/src/infra/http/express/app.ts#L180-L191)

### Tests

- **Unit Tests**:
  - [`asset-validation.test.ts`](../../apps/node/src/_tests/asset-validation.test.ts) - MIME detection + size limits
  - [`asset-virus-scan.test.ts`](../../apps/node/src/_tests/asset-virus-scan.test.ts) - Mock scanner integration

- **Integration Tests**:
  - [`asset-upload-integration.test.ts`](../../apps/node/src/_tests/asset-upload-integration.test.ts) - End-to-end upload with validation

### External Dependencies

- **[file-type](https://github.com/sindresorhus/file-type)** (v19.6.0) - Magic bytes MIME detection
- **[clamscan](https://github.com/kylefarris/clamscan)** (v2.4.0) - ClamAV Node.js client
- **[@types/clamscan](https://www.npmjs.com/package/@types/clamscan)** (v2.4.1) - TypeScript definitions

### ClamAV Resources

- **[ClamAV Official Docker Image](https://hub.docker.com/r/clamav/clamav)**
- **[ClamAV Documentation](https://docs.clamav.net/)**
- **[EICAR Test File](https://www.eicar.org/download-anti-malware-testfile/)** - Standard test virus

### Related Documentation

- [Backend API Overview](./README.md)
- [Architecture Guide](../architecture.md)
- [Docker Deployment](../docker.md)
- [Environment Configuration](../../.env.dev.example) (development template)
- [Performance Tuning](./performance.md) - Impact of scanning on upload throughput

---

**Last updated**: February 2026
