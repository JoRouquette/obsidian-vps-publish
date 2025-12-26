# Artillery Load Tests

This directory contains Artillery load tests for the API session upload workflow.

## Structure

```
tools/load-tests/artillery/
├── scenarios/          # Artillery YAML configurations
│   ├── quick.yml       # Quick smoke test (10 notes, 5 assets)
│   ├── session-upload.yml  # Configurable via env vars
│   ├── load-200.yml    # 200 notes, 40 assets
│   ├── load-500.yml    # 500 notes, 80 assets
│   └── load-1000.yml   # 1000 notes, 150 assets
├── helpers/            # JavaScript payload generators
│   ├── note-generator.js      # DTO-compliant note generation
│   ├── asset-generator.js     # Base64-encoded asset generation
│   └── session-processor.js   # Workflow orchestration
└── reports/            # Generated reports (gitignored)
```

## Quick Start

```bash
# 1. Configure environment
cp .env.artillery.example .env.artillery
# Edit .env.artillery with your API_KEY

# 2. Start the API
npm run start node

# 3. Run load test
npm run load:api:quick         # Fast smoke test
npm run load:api:50            # 50 notes (default distribution)
npm run load:api:200           # 200 notes (default distribution)
npm run load:api:300:balanced  # 300 notes (equal sizes)
npm run load:api:400:large     # 400 notes (50% large)
npm run load:api:500           # 500 notes (balanced)
npm run load:api:1000          # 1000 notes (balanced)
```

## Documentation

See [docs/api/load-testing.md](../../../docs/api/load-testing.md) for:

- Detailed usage instructions
- Environment variables
- Test profiles and configurations
- Result interpretation
- Troubleshooting
- Adding new test profiles

## Features

- **DTO-compliant payloads**: All generated data matches API Zod schemas
- **Configurable size distributions**: default (60/30/10), balanced (33/33/34), smallFocused (80/15/5), largeFocused (20/30/50)
- **Variable sizes**: Small/medium/large notes and assets with realistic content
- **Single-user simulation**: Tests volume, not concurrency (1 virtual user)
- **Reproducible**: Use SEED env var for deterministic results
- **Complete workflow**: Creates session → uploads notes → uploads assets → finishes session
- **Comprehensive coverage**: New scenarios ensure all note sizes are well-tested

## NPM Scripts

| Command                         | Description                                        |
| ------------------------------- | -------------------------------------------------- |
| `npm run load:api:quick`        | Quick smoke test (10 notes, CI-friendly)           |
| `npm run load:api:50`           | Light load (50 notes, default distribution)        |
| `npm run load:api:200`          | Medium load (200 notes, default distribution)      |
| `npm run load:api:300:balanced` | Balanced load (300 notes, equal size distribution) |
| `npm run load:api:400:large`    | Large-focused (400 notes, 50% large notes)         |
| `npm run load:api:500`          | Heavy load (500 notes, balanced distribution)      |
| `npm run load:api:1000`         | Extreme load (1000 notes, balanced distribution)   |
| `npm run load:api:*:report`     | Same as above with JSON report output              |

## Environment Variables

Required in `.env.artillery`:

```bash
BASE_URL=http://localhost:3000
API_KEY=your-api-key
NOTES_COUNT=50              # Override per scenario
ASSETS_COUNT=20             # Override per scenario
SEED=12345                  # For reproducibility
NOTE_SIZE_PROFILE=default   # default | balanced | smallFocused | largeFocused
```

## Example Output

```
Summary report @ 16:23:45(+0100)
  Scenarios launched:  1
  Scenarios completed: 1
  Requests completed:  4
  Response time (msec):
    p50: 891
    p95: 2100
    p99: 2150
  Codes:
    200: 3
    201: 1
```

## Troubleshooting

- **4xx errors**: Check API_KEY and DTO payload structure
- **5xx errors**: Check backend logs, may be OOM or crash
- **Timeouts**: Reduce NOTES_COUNT or increase server resources
- **High latency**: Profile backend, check for bottlenecks

See full troubleshooting guide in [docs/api/load-testing.md](../../../docs/api/load-testing.md).

## References

- [Artillery Documentation](https://www.artillery.io/docs)
- [API DTOs](../../../apps/node/src/infra/http/express/dto/)
- [Session Controller](../../../apps/node/src/infra/http/express/controllers/session-controller.ts)
