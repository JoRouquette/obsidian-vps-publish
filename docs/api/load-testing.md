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

| Profile               | Notes | Assets | Distribution        | Duration | Use Case                  |
| --------------------- | ----- | ------ | ------------------- | -------- | ------------------------- |
| **quick**             | 10    | 5      | default (60/30/10)  | 30s      | Smoke test, CI/CD         |
| **load-50**           | 50    | 20     | default (60/30/10)  | 60s      | Light load baseline       |
| **load-200**          | 200   | 40     | default (60/30/10)  | 120s     | Medium load               |
| **load-300-balanced** | 300   | 60     | balanced (33/33/34) | 240s     | Equal size coverage       |
| **load-400-large**    | 400   | 80     | large (20/30/50)    | 360s     | Large notes stress test   |
| **load-500**          | 500   | 100    | balanced (33/33/34) | 180s     | Heavy load with balance   |
| **load-1000**         | 1000  | 200    | balanced (33/33/34) | 300s     | Extreme load with balance |

### Payload Size Distribution

**Distribution Presets** (configurable via `NOTE_SIZE_PROFILE` env var):

- **default** (60/30/10): 60% small, 30% medium, 10% large - Better coverage for all sizes
- **balanced** (33/33/34): Equal distribution - Comprehensive testing of all sizes
- **smallFocused** (80/15/5): Mostly small notes - Fast tests, minimal resource usage
- **largeFocused** (20/30/50): Majority large notes - Stress test with heavy payloads

**Notes** (markdown content):

- Small (1-5 KB): Basic notes with headers and paragraphs
- Medium (20-80 KB): Detailed notes with code blocks, lists
- Large (200-800 KB): Extensive documents with multiple sections

**Assets** (base64-encoded binaries):

- Small (50 KB): Icons, thumbnails
- Medium (500 KB): Standard images
- Large (2-8 MB): High-res images, PDFs

**Example usage**:

```bash
# Use balanced distribution for comprehensive testing
NOTE_SIZE_PROFILE=balanced npm run load:api:500

# Stress test with large notes
NOTE_SIZE_PROFILE=largeFocused npm run load:api:400

# Quick test with small notes only
NOTE_SIZE_PROFILE=smallFocused npm run load:api:50
```

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
NOTE_SIZE_PROFILE=default  # default | balanced | smallFocused | largeFocused
```

### Scenario Files

Located in `tools/load-tests/artillery/scenarios/`:

- `quick.yml` - Fast smoke test (10 notes, default distribution)
- `session-upload.yml` - Configurable via env vars
- `load-200.yml` - 200 notes (default distribution)
- `load-300-balanced.yml` - 300 notes (balanced: 100 of each size)
- `load-400-large.yml` - 400 notes (large-focused: 50% large notes)
- `load-500.yml` - 500 notes (balanced: ~167 of each size)
- `load-1000.yml` - 1000 notes (balanced: ~333 of each size)

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

**Standard profiles** (génèrent automatiquement JSON + HTML) :

```bash
npm run load:api:50              # 50 notes (default: 30 small, 15 medium, 5 large)
npm run load:api:200             # 200 notes (default: 120 small, 60 medium, 20 large)
npm run load:api:300:balanced    # 300 notes (balanced: ~100 of each size)
npm run load:api:400:large       # 400 notes (large-focused: ~200 large notes)
npm run load:api:500             # 500 notes (balanced: ~167 of each size)
npm run load:api:1000            # 1000 notes (balanced: ~333 of each size)
```

**Alias `:report`** (identique aux commandes ci-dessus) :

```bash
npm run load:api:50:report              # Alias de load:api:50
npm run load:api:200:report             # Alias de load:api:200
npm run load:api:300:balanced:report    # Alias de load:api:300:balanced
npm run load:api:400:large:report       # Alias de load:api:400:large
npm run load:api:500:report             # Alias de load:api:500
npm run load:api:1000:report            # Alias de load:api:1000
```

**Tous les tests génèrent automatiquement** :

- `*.json` : Données brutes Artillery (dans `tools/load-tests/artillery/reports/`)
- `*.html` : Rapport interactif visualisable dans un navigateur

Les rapports HTML peuvent être ouverts directement pour une visualisation complète des métriques (temps de réponse, codes HTTP, erreurs, etc.).

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

### HTML Reports

Les scripts avec `:report` génèrent automatiquement un rapport HTML interactif en plus du JSON :

```bash
npm run load:api:300:balanced:report
# Génère 2 fichiers :
# - tools/load-tests/artillery/reports/load-300-balanced.json (données brutes)
# - tools/load-tests/artillery/reports/load-300-balanced.html (visualisation)
```

**Ouvrir le rapport HTML** :

```bash
# Méthode 1 : Script npm (ouvre le rapport le plus récent)
npm run load:report:open

# Méthode 2 : Helper script avec nom spécifique
node tools/load-tests/artillery/helpers/open-report.cjs load-300-balanced

# Méthode 3 : Helper script (ouvre le plus récent automatiquement)
node tools/load-tests/artillery/helpers/open-report.cjs

# Méthode 4 : Commandes système
# Windows
start tools/load-tests/artillery/reports/load-300-balanced.html

# Linux/Mac
open tools/load-tests/artillery/reports/load-300-balanced.html
```

**Contenu du rapport HTML** :

- 📊 **Vue d'ensemble** : Scénarios complétés/échoués, requêtes totales
- 🚦 **Codes HTTP** : Distribution 2xx/4xx/5xx avec codes de couleur
- ⏱️ **Temps de réponse** : Min/Médiane/Moyenne/P95/P99/Max avec graphiques
- 👥 **Sessions VU** : Durée des sessions utilisateurs virtuels
- ❌ **Erreurs** : Liste détaillée des erreurs rencontrées
- 📈 **Métriques détaillées** : Tableau complet des codes HTTP

Les rapports HTML sont **auto-suffisants** (aucune dépendance externe) et peuvent être partagés facilement avec l'équipe.

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
      name: 'Load test - 750 notes'
  processor: './helpers/session-processor.js'
  variables:
    apiKey: "{{ $env.API_KEY || 'test-api-key' }}"
    notesCount: 750
    assetsCount: 120
  plugins:
    expect: {}

scenarios:
  - name: 'Load Test - 750 Notes'
    flow:
      - function: 'generateSessionPayloads'
      # ... (same structure as other scenarios)
```

2. **Add npm script** to `package.json`:

```json
"load:api:750": "artillery run tools/load-tests/artillery/scenarios/load-750.yml --dotenv .env.artillery",
"load:api:750:report": "artillery run tools/load-tests/artillery/scenarios/load-750.yml --dotenv .env.artillery --output tools/load-tests/artillery/reports/load-750.json"
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
