# Performance Enhancements - Implementation Summary

## Overview

This implementation addresses performance bottlenecks revealed by Artillery load testing, specifically:

- Throughput plateau at ~1 req/s
- HTTP 429 backpressure responses
- High latency on `/api/session/finish` (avg >1s, p95 ~1.8s)

**Root Cause**: Synchronous, CPU-intensive session finalization blocking the Node.js event loop.

**Solution**: Comprehensive instrumentation + async job queue for session finalization.

---

## Changes Implemented

### 1. Request Correlation Middleware (Observability)

**Files Added**:

- `apps/node/src/infra/http/express/middleware/request-correlation.middleware.ts`
- `apps/node/src/infra/http/express/middleware/_tests/request-correlation.middleware.test.ts`

**Purpose**: Enable distributed tracing by generating/propagating `x-request-id` across all requests.

**Impact**:

- Every request/response now includes `x-request-id` header
- All logs include `requestId` for correlation
- Easier debugging of concurrent request issues

**Integration**: Added as first middleware in `apps/node/src/infra/http/express/app.ts`.

---

### 2. Backpressure Attribution (429 Transparency)

**Files Modified**:

- `apps/node/src/infra/http/express/middleware/backpressure.middleware.ts`

**Changes**:

- Added `cause` field to 429 responses: `active_requests` | `event_loop_lag` | `memory_pressure`
- Added `source: 'app'` to distinguish app vs upstream rate limiting
- Added RFC-compliant `Retry-After` header + `X-RateLimit-*` headers
- Include `requestId` in all 429 responses

**Impact**:

- 429 responses now explicitly state WHY they occurred
- Clients can distinguish between different backpressure causes
- Ops can filter logs by `cause` to diagnose root issues

---

### 3. Session Finalization Timing Breakdown

**Files Modified**:

- `apps/node/src/infra/sessions/session-finalizer.service.ts`

**Changes**:

- Added per-step timing instrumentation (12 steps)
- Log each step's duration + percentage of total time
- Identify which steps consume the most CPU/I/O

**Instrumented Steps**:

1. Load raw notes
2. Load session metadata
3. Load cleanup rules
4. Detect Leaflet blocks
5. Sanitize content
6. Convert markdown links
7. Resolve wikilinks + routing
8. Reset content stage
9. Render markdown to HTML
10. Extract custom indexes
11. Rebuild indexes
12. Rebuild search index
13. Clear session storage

**Impact**:

- Log entry: `[PERF] Session rebuild completed` with full breakdown
- Example: `{ step: 'renderMarkdownToHtml', durationMs: '450.23', percentOfTotal: '35.2' }`
- Data-driven optimization (target the slowest 2-3 steps)

---

### 4. Enhanced Health Endpoint

**Files Modified**:

- `apps/node/src/infra/http/express/controllers/health-check.controller.ts`

**Changes**:

- Expose event loop lag (`load.eventLoopLagMs`)
- Expose active requests, memory usage
- Return 503 (Service Unavailable) if `isUnderPressure: true`
- Include performance metrics (request count, avg/max/min duration, slow requests)

**Response Structure**:

```json
{
  "status": "healthy" | "degraded",
  "uptime": 3600,
  "memory": { "heapUsedMB": "120.45", ... },
  "load": {
    "activeRequests": 5,
    "eventLoopLagMs": 45.23,
    "isUnderPressure": false
  },
  "performance": {
    "requestCount": 1234,
    "avgDurationMs": 123.45,
    "slowRequestsCount": 2
  }
}
```

**Impact**:

- Real-time visibility into server health
- Can be polled by monitoring systems (Prometheus, DataDog, etc.)
- Alerts when event loop lag > threshold

---

### 5. Async Session Finalization (Breaking Change)

**Files Added**:

- `apps/node/src/infra/sessions/session-finalization-job.service.ts`

**Files Modified**:

- `apps/node/src/infra/http/express/controllers/session-controller.ts`
- `apps/node/src/infra/http/express/app.ts`

**Changes**:

- `POST /api/session/:id/finish` now returns **202 Accepted** (not 200 OK)
- Response includes `jobId` + `statusUrl` for polling
- Heavy finalization work (rebuild, staging promotion) queued in background
- New endpoint: `GET /api/session/:id/status` to poll job progress

**API Contract (Before)**:

```
POST /finish → 200 OK (blocks 1-2s)
{
  "sessionId": "...",
  "success": true
}
```

**API Contract (After)**:

```
POST /finish → 202 Accepted (returns immediately)
{
  "sessionId": "...",
  "success": true,
  "jobId": "...",
  "statusUrl": "/api/session/.../status"
}

GET /status → 200 OK
{
  "jobId": "...",
  "sessionId": "...",
  "status": "pending" | "processing" | "completed" | "failed",
  "progress": 0-100,
  "createdAt": "...",
  "completedAt": "..."
}
```

**Impact**:

- **Throughput improvement**: Finish no longer blocks event loop
- **Expected**: 1 req/s → 5+ req/s (5x improvement)
- **Latency improvement**: HTTP response < 50ms (was 1800ms)
- **Breaking change**: Clients must poll `/status` instead of blocking

**Migration Path**:

- Update Obsidian plugin to poll `/status` after `/finish`
- Add timeout (max 30s) and error handling for job failures

---

### 6. Artillery Test Updates

**Files Modified**:

- `artillery-load-test.yml`
- `artillery-processor.js`

**Changes**:

- Capture `x-request-id` from responses
- Log 429 `cause` + `source` + `requestId`
- Poll `/status` endpoint after `/finish` (max 60 iterations)
- Track job completion metrics (`job.completed`, `job.failed`)
- Break loop when job completes/fails

**Impact**:

- Test now exercises full async workflow
- Measures job completion time (not just HTTP response)
- Validates polling mechanism

---

### 7. Performance Regression Tests

**Files Added**:

- `apps/node/src/infra/sessions/_tests/session-finalization-perf.test.ts`

**Purpose**: Automated performance regression detection.

**Tests**:

- Small batch (50 notes): p95 < 500ms
- Medium batch (100 notes): p95 < 1000ms
- Large batch (300 notes): p95 < 2000ms

**Usage**:

```bash
ENABLE_PERF_TESTS=true npm test -- session-finalization-perf.test.ts
```

**Impact**:

- Catch performance regressions in CI
- Data-driven thresholds (configurable via env)
- Skip by default (enabled on-demand for perf validation)

---

### 8. Documentation

**Files Added**:

- `docs/api/performance/artillery-report-analysis.md` (critical analysis)
- `docs/api/performance/validation-checklist.md` (pre-deploy checklist)
- `docs/api/performance/README.md` (index + quick start)

**Content**:

- **Analysis**: What the test proves/doesn't prove, causal hypotheses, recommended fixes
- **Checklist**: Step-by-step validation (instrumentation, API contract, performance metrics)
- **Index**: Links to all perf docs, quick start commands, troubleshooting

**Impact**:

- Future devs can understand WHY changes were made
- Repeatable validation process
- Troubleshooting guide for common issues

---

## Commit Plan (Atomic Commits)

```bash
# 1. Observability foundation
git add apps/node/src/infra/http/express/middleware/request-correlation.middleware.ts
git add apps/node/src/infra/http/express/middleware/_tests/request-correlation.middleware.test.ts
git add apps/node/src/infra/http/express/app.ts
git commit -m "chore(obs): add request correlation middleware for distributed tracing"

# 2. 429 attribution
git add apps/node/src/infra/http/express/middleware/backpressure.middleware.ts
git commit -m "feat(api): attribute and expose rate limit causes for 429 responses"

# 3. Session finalization instrumentation
git add apps/node/src/infra/sessions/session-finalizer.service.ts
git commit -m "chore(obs): add detailed timing breakdown for session finalization"

# 4. Enhanced health endpoint
git add apps/node/src/infra/http/express/controllers/health-check.controller.ts
git commit -m "feat(api): expose event loop lag and load metrics in health endpoint"

# 5. Async finalization (breaking change)
git add apps/node/src/infra/sessions/session-finalization-job.service.ts
git add apps/node/src/infra/http/express/controllers/session-controller.ts
git add apps/node/src/infra/http/express/app.ts
git commit -m "perf(api): refactor session finish to async job queue

BREAKING CHANGE: POST /api/session/:id/finish now returns 202 Accepted with jobId. Clients must poll GET /api/session/:id/status for completion."

# 6. Artillery updates
git add artillery-load-test.yml
git add artillery-processor.js
git commit -m "test(loadtest): update artillery scenarios for async finish workflow"

# 7. Performance tests
git add apps/node/src/infra/sessions/_tests/session-finalization-perf.test.ts
git commit -m "test(perf): add regression tests for session finalization latency"

# 8. Documentation
git add docs/api/performance/
git commit -m "docs(api): add performance analysis and validation checklist"
```

---

## Validation Checklist (Before Merge)

- [ ] All TypeScript compilation passes (`npx tsc --noEmit`)
- [ ] All lint checks pass (`npm run lint`)
- [ ] All tests pass (`npm test`)
- [ ] Artillery test runs successfully (at least warmup phase)
- [ ] `/health` endpoint returns detailed metrics
- [ ] 429 responses include `cause` + `source` + `requestId`
- [ ] `/finish` returns 202 + `jobId`
- [ ] `/status` endpoint returns job progress
- [ ] Logs show `[PERF] Session rebuild completed` with timing breakdown
- [ ] Documentation builds and renders correctly

---

## Expected Impact

| Metric         | Before      | After (Expected) | Measurement                       |
| -------------- | ----------- | ---------------- | --------------------------------- |
| Throughput     | ~1 req/s    | > 5 req/s        | Artillery sustained load          |
| Finish p95     | ~1800ms     | < 500ms          | Artillery `/finish` HTTP response |
| Event loop lag | High spikes | < 100ms avg      | `/health` endpoint                |
| 429 rate       | Frequent    | < 1%             | Artillery error rate              |
| Observability  | Limited     | Full tracing     | Logs + metrics                    |

---

## Migration Guide (for Obsidian Plugin)

### Breaking Change: Async Finish

**Old Workflow**:

```typescript
const response = await fetch('/api/session/:id/finish', { method: 'POST' });
// Session is ready immediately
```

**New Workflow**:

```typescript
// 1. Start finalization (returns immediately)
const finishResponse = await fetch('/api/session/:id/finish', { method: 'POST' });
if (finishResponse.status !== 202) {
  throw new Error('Unexpected status');
}

const { jobId, statusUrl } = await finishResponse.json();

// 2. Poll status until completed
const maxAttempts = 60; // 30s with 0.5s interval
for (let i = 0; i < maxAttempts; i++) {
  await new Promise((resolve) => setTimeout(resolve, 500)); // 0.5s delay

  const statusResponse = await fetch(statusUrl);
  const status = await statusResponse.json();

  if (status.status === 'completed') {
    // Session is ready
    break;
  } else if (status.status === 'failed') {
    throw new Error(`Finalization failed: ${status.error}`);
  }

  // Update progress UI: status.progress (0-100)
}
```

**Backwards Compatibility**: None. Plugin MUST be updated to support async workflow.

---

## Next Steps (Future Work)

### Immediate (This PR)

- [x] Implement instrumentation
- [x] Implement async finalization
- [x] Update Artillery tests
- [x] Add performance regression tests
- [x] Document changes

### Post-Merge (Follow-Up PRs)

- [ ] Update Obsidian plugin to poll `/status`
- [ ] Add worker threads for markdown rendering (if profiling shows CPU bottleneck)
- [ ] Add Prometheus metrics export (if monitoring stack exists)
- [ ] Optimize identified slow steps (based on timing breakdown logs)

### Long-Term (Future Releases)

- [ ] Incremental processing: render during upload, not at finish
- [ ] Add Redis-backed job queue (for multi-instance deployment)
- [ ] Add WebSocket for real-time progress updates (avoid polling)

---

## References

- [Artillery Report Analysis](./docs/api/performance/artillery-report-analysis.md)
- [Validation Checklist](./docs/api/performance/validation-checklist.md)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
