# API Load Testing with Artillery

## Purpose

Load testing validates the API's ability to handle realistic workloads, identify performance bottlenecks, and ensure acceptable response times under different volumes of notes and assets.

## When to Use

- Before major releases to validate performance
- After significant backend refactoring
- To establish performance baselines
- To identify bottlenecks with large uploads
- To test session upload workflow end-to-end

## Key Concepts

### Test Architecture

The load tests use **Artillery** to simulate realistic user sessions that upload notes and assets to the API. The tests:

- Simulate a **single user** uploading varying numbers of notes (not concurrent users)
- Generate **DTO-compliant payloads** matching API requirements
- Use **variable payload sizes** (small/medium/large) with distribution (70%/25%/5%)
- Follow the complete **session workflow**: start → upload notes → upload assets → finish

### Test Profiles

| Profile | Notes | Assets | Duration | Use Case |
|---------|-------|--------|----------|----------|
| **quick** | 10 | 5 | 30s | Smoke test, CI/CD |
| **load-50** | 50 | 20 | 60s | Light load baseline |
| **load-200** | 200 | 40 | 120s | Medium load |
| **load-500** | 500 | 80 | 180s | Heavy load |
| **load-1000** | 1000 | 150 | 300s | Extreme load |

### Payload Size Distribution

**Notes** (markdown content):
- Small (70%): 1-5 KB
- Medium (25%): 20-80 KB
- Large (5%): 200-800 KB

**Assets** (base64-encoded binaries):
- Small (70%): 50 KB
- Medium (25%): 500 KB
- Large (5%): 2-8 MB

## Configuration

### Environment Variables

Create `.env.artillery` from `.env.artillery.example`:

```bash
cp .env.artillery.example .env.artillery
```

Required variables:

```bash
# API endpoint
BASE_URL=http://localhost:3000

# Authentication (copy from .env.dev)
API_KEY=your-api-key-here

# Test parameters (override per scenario)
NOTES_COUNT=50
ASSETS_COUNT=20
SEED=12345  # For reproducible results
```

### Scenario Files

Located in `tools/load-tests/artillery/scenarios/`:

- `quick.yml` - Fast smoke test (10 notes)
- `session-upload.yml` - Configurable via env vars
- `load-200.yml` - 200 notes
- `load-500.yml` - 500 notes
- `load-1000.yml` - 1000 notes

### Payload Generators

Located in `tools/load-tests/artillery/helpers/`:

- `note-generator.js` - Generates DTO-compliant notes with variable sizes
- `asset-generator.js` - Generates base64-encoded assets
- `session-processor.js` - Orchestrates the session workflow

All generators respect:
- Zod DTOs from `apps/node/src/infra/http/express/dto/`
- Size distributions
- Reproducible randomness via `SEED`

## Usage

### Prerequisites

```bash
# 1. Install dependencies (Artillery already included)
npm install

# 2. Configure environment
cp .env.artillery.example .env.artillery
# Edit .env.artillery with your API_KEY

# 3. Start the API
npm run start node
# or via Docker:
npm run docker:dev:up
```

### Running Tests

**Quick smoke test** (for CI):
```bash
npm run load:api:quick
```

**Standard profiles**:
```bash
npm run load:api:50      # 50 notes
npm run load:api:200     # 200 notes
npm run load:api:500     # 500 notes
npm run load:api:1000    # 1000 notes
```

**With JSON report output**:
```bash
npm run load:api:50:report
npm run load:api:200:report
# etc.
```

**Custom parameters**:
```bash
NOTES_COUNT=100 ASSETS_COUNT=30 SEED=999 npm run load:api:50
```

### Generating HTML Reports

```bash
# Run test and save JSON
npm run load:api:200:report

# Generate HTML from JSON
artillery report tools/load-tests/artillery/reports/load-200-*.json \
  --output tools/load-tests/artillery/reports/load-200.html

# Open in browser
open tools/load-tests/artillery/reports/load-200.html
```

## Interpreting Results

### Key Metrics

Artillery outputs several critical metrics:

**Request Metrics**:
- `http.requests`: Total requests made
- `http.responses`: Total responses received
- `http.response_time.*`: Response time percentiles (p50, p95, p99)

**Scenario Metrics**:
- `vusers.completed`: Number of completed scenarios (should be 1)
- `vusers.failed`: Number of failed scenarios (should be 0)

**Status Codes**:
- `http.codes.200`: Successful operations
- `http.codes.201`: Session created
- `http.codes.4xx/5xx`: Errors (investigate if present)

### Success Criteria

A successful load test should have:

1. **Zero errors**: No 4xx/5xx status codes
2. **Acceptable latency**:
   - p50 < 1000ms for most endpoints
   - p95 < 3000ms
   - p99 < 5000ms
3. **All scenarios completed**: `vusers.completed = 1`, `vusers.failed = 0`
4. **Memory stability**: No memory leaks (monitor with Docker stats)

### Example Output

```
Summary report @ 16:23:45(+0100)
  Scenarios launched:  1
  Scenarios completed: 1
  Requests completed:  4
  Mean response/sec:   0.13
  Response time (msec):
    min: 234
    max: 2156
    median: 891
    p95: 2100
    p99: 2150
  Scenario duration (msec):
    min: 8234
    max: 8234
    median: 8234
  Codes:
    200: 3
    201: 1
```

**Interpretation**:
- ✅ All scenarios completed (1/1)
- ✅ All requests successful (201 for create, 200 for others)
- ✅ Response times acceptable (p95 = 2.1s for large payload)
- ⚠️ Total duration = 8.2s for entire workflow

### Troubleshooting

**High latency (p95 > 5s)**:
- Check payload sizes: large assets may exceed server limits
- Monitor server resources: CPU, memory, disk I/O
- Review `console.log` output in terminal for generator timings

**4xx errors**:
- `400 Bad Request`: DTO validation failed, check payload structure
- `401 Unauthorized`: API_KEY incorrect or missing
- `404 Not Found`: Session expired or invalid endpoint

**5xx errors**:
- `500 Internal Server Error`: Server-side crash, check backend logs
- `503 Service Unavailable`: Server overloaded or out of memory

**Timeout errors**:
- Increase Artillery timeout in config: `config.timeout: 300`
- Reduce payload size or note count
- Check network latency to server

**Memory issues**:
```bash
# Monitor Docker container
docker stats

# If API crashes with OOM:
# - Reduce NOTES_COUNT or ASSETS_COUNT
# - Increase Docker memory limit
# - Review backend memory usage with profiler
```

## Adding New Test Profiles

To add a new load profile (e.g., 750 notes):

1. **Create scenario file**: `tools/load-tests/artillery/scenarios/load-750.yml`

```yaml
config:
  target: "{{ $env.BASE_URL || 'http://localhost:3000' }}"
  phases:
    - duration: 240
      arrivalRate: 1
      maxVusers: 1
      name: "Load test - 750 notes"
  processor: "./helpers/session-processor.js"
  variables:
    apiKey: "{{ $env.API_KEY || 'test-api-key' }}"
    notesCount: 750
    assetsCount: 120
  plugins:
    expect: {}

scenarios:
  - name: "Load Test - 750 Notes"
    flow:
      - function: "generateSessionPayloads"
      # ... (same structure as other scenarios)
```

2. **Add npm script** to `package.json`:

```json
"load:api:750": "artillery run tools/load-tests/artillery/scenarios/load-750.yml --dotenv .env.artillery",
"load:api:750:report": "artillery run tools/load-tests/artillery/scenarios/load-750.yml --dotenv .env.artillery --output tools/load-tests/artillery/reports/load-750-$(date +%Y%m%d-%H%M%S).json"
```

3. **Run and validate**:

```bash
npm run load:api:750
```

## CI Integration

For continuous integration, use the **quick** profile to avoid overloading CI runners:

```yaml
# .github/workflows/performance.yml
- name: API Load Test
  run: npm run load:api:quick
  env:
    BASE_URL: http://localhost:3000
    API_KEY: ${{ secrets.API_KEY }}
```

**Important**: Quick test only (10 notes, 30s) to keep CI fast. Full load tests should run manually or on-demand.

## Architecture Details

### Session Workflow

1. **POST /api/session/start**
   - Body: `CreateSessionBodyDto`
   - Returns: `{ sessionId, success, maxBytesPerRequest }`
   - Captured: `sessionId` for subsequent requests

2. **POST /api/session/:sessionId/notes/upload**
   - Body: `UploadSessionNotesBodyDto` with array of `PublishableNoteDto`
   - Validates: frontmatter, routing, eligibility, content

3. **POST /api/session/:sessionId/assets/upload**
   - Body: `ApiAssetsBodyDto` with array of `ApiAssetDto`
   - Assets: base64-encoded with mimeType, paths

4. **POST /api/session/:sessionId/finish**
   - Body: `FinishSessionBodyDto` with counts
   - Finalizes session, commits content to disk

### DTO Compliance

All payloads are **strictly validated** against Zod schemas:

- `CreateSessionBodyDto`: notesPlanned, assetsPlanned, batchConfig
- `PublishableNoteDto`: noteId, title, content, frontmatter, routing, eligibility
- `ApiAssetDto`: relativePath, vaultPath, fileName, mimeType, contentBase64
- `FinishSessionBodyDto`: notesProcessed, assetsProcessed

Generators ensure:
- Required fields present
- Correct types (string, number, boolean, array, object)
- Valid enums (e.g., `origin: 'content' | 'frontmatter'`)
- Proper nesting (frontmatter.flat, frontmatter.nested, frontmatter.tags)

### Reproducibility

Tests are **deterministic** when `SEED` is set:

```bash
SEED=12345 npm run load:api:50
```

Same seed → same notes → same assets → same payloads.

Useful for:
- Debugging specific payload combinations
- Comparing performance across code changes
- Reproducing issues in CI

## References

- [Artillery Documentation](https://www.artillery.io/docs)
- [apps/node/src/infra/http/express/dto/](../../apps/node/src/infra/http/express/dto/) - DTO definitions
- [apps/node/src/infra/http/express/controllers/session-controller.ts](../../apps/node/src/infra/http/express/controllers/session-controller.ts) - API endpoints
- [tools/load-tests/artillery/](../../tools/load-tests/artillery/) - Test files
