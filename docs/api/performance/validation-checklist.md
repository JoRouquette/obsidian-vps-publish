# Performance Validation Checklist

## Pre-Deployment Verification

This checklist ensures performance fixes are validated before merging/deploying.

---

## 1. Instrumentation Verification

### ✅ Request Correlation

- [ ] All API requests log `requestId` (check logs)
- [ ] Response headers include `x-request-id`
- [ ] Request ID propagates through services (check nested logs)

**Validation**:

```bash
curl -H "x-api-key: $API_KEY" http://localhost:3000/api/ping -v | grep x-request-id
# Should return: x-request-id: <uuid>
```

### ✅ Event Loop Lag Tracking

- [ ] `/health` endpoint exposes `load.eventLoopLagMs`
- [ ] Event loop lag < 100ms under normal load
- [ ] Event loop lag > 200ms triggers backpressure (429)

**Validation**:

```bash
curl http://localhost:3000/health | jq '.load.eventLoopLagMs'
# Should return: < 100 (healthy), > 200 (under pressure)
```

### ✅ Session Finish Timing Breakdown

- [ ] Logs show per-step timings for finish operation
- [ ] Each step logged with `durationMs` and `percentOfTotal`
- [ ] Identify top 2-3 slowest steps

**Validation**:

```bash
# Trigger finish, check logs for:
# [PERF] Session rebuild completed
# timings: [
#   { step: 'resolveWikilinksAndRouting', durationMs: '450.23', percentOfTotal: '35.2' },
#   { step: 'renderMarkdownToHtml', durationMs: '380.12', percentOfTotal: '29.7' },
#   ...
# ]
```

---

## 2. Backpressure Attribution (429 Transparency)

### ✅ 429 Response Structure

- [ ] 429 responses include `cause` field (active_requests|event_loop_lag|memory_pressure)
- [ ] 429 responses include `source: 'app'`
- [ ] 429 responses include `retryAfterMs` + `Retry-After` header
- [ ] 429 responses include `requestId` for correlation

**Validation**:

```bash
# Trigger backpressure (spam requests)
for i in {1..60}; do curl -H "x-api-key: $API_KEY" http://localhost:3000/api/ping & done

# Check 429 response:
# {
#   "error": "Too Many Requests",
#   "cause": "active_requests",
#   "source": "app",
#   "retryAfterMs": 5000,
#   "requestId": "..."
# }
```

### ✅ 429 Logging

- [ ] Logs show 429 cause + requestId
- [ ] Logs distinguish app vs upstream rate limiting (if applicable)

**Validation**: Check logs for `[BACKPRESSURE]` entries with cause.

---

## 3. Async Session Finalization

### ✅ API Contract Changes

- [ ] `POST /api/session/:id/finish` returns 202 Accepted (not 200)
- [ ] Response includes `jobId` and `statusUrl`
- [ ] `GET /api/session/:id/status` returns job progress

**Validation**:

```bash
# Start session + upload notes
SESSION_ID=$(curl -X POST -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"notesPlanned":10,"assetsPlanned":5,"batchConfig":{"maxBytesPerRequest":5242880}}' \
  http://localhost:3000/api/session/start | jq -r '.sessionId')

# Finish (should return 202)
FINISH_RESPONSE=$(curl -X POST -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"notesProcessed":10,"assetsProcessed":5}' \
  http://localhost:3000/api/session/$SESSION_ID/finish)

echo $FINISH_RESPONSE | jq '.jobId, .statusUrl'
# Should return jobId and statusUrl

# Poll status
JOB_ID=$(echo $FINISH_RESPONSE | jq -r '.jobId')
curl -H "x-api-key: $API_KEY" \
  http://localhost:3000/api/session/$SESSION_ID/status | jq '.status, .progress'
# Should return: "completed", 100 (after job finishes)
```

### ✅ Job Queue Behavior

- [ ] Multiple finish requests queue sequentially (no concurrency issues)
- [ ] Old jobs cleaned up after 1 hour
- [ ] Queue stats available (check logs or add /metrics endpoint)

**Validation**: Trigger 3 finishes in parallel, check logs for sequential processing.

---

## 4. Performance Metrics (Artillery)

### ✅ Baseline Comparison

Run Artillery BEFORE and AFTER changes, compare:

| Metric              | Before | After | Target | Status |
| ------------------- | ------ | ----- | ------ | ------ |
| Throughput (req/s)  | ~1     | ?     | > 5    | ⏳     |
| Finish p95 (ms)     | ~1800  | ?     | < 500  | ⏳     |
| 429 rate (%)        | ?      | ?     | < 1%   | ⏳     |
| Event loop lag (ms) | ?      | ?     | < 100  | ⏳     |

**Validation**:

```bash
# Run baseline
npm run artillery:baseline > baseline.json

# Apply changes, run again
npm run artillery:test > after-changes.json

# Compare
npm run artillery:compare baseline.json after-changes.json
```

### ✅ Artillery Scenario Updates

- [ ] Artillery captures `x-request-id` from responses
- [ ] Artillery logs 429 `cause` + `source`
- [ ] Artillery polls `/status` endpoint until job completes
- [ ] Artillery measures job completion time (not just HTTP response)

**Validation**: Check Artillery output logs for `[JOB] Finalization completed`.

---

## 5. Regression Tests (Jest)

### ✅ Performance Test Suite

- [ ] `session-finalization-perf.test.ts` exists
- [ ] Tests run with `ENABLE_PERF_TESTS=true`
- [ ] Tests fail if p95 exceeds thresholds

**Validation**:

```bash
ENABLE_PERF_TESTS=true npm test -- session-finalization-perf.test.ts
# Should pass with p95 < configured thresholds
```

### ✅ Functional Tests Pass

- [ ] All existing Jest tests pass (no regressions)
- [ ] Integration tests cover new `/status` endpoint
- [ ] Error handling tested (job failure, timeout)

**Validation**:

```bash
npm test
# All tests should pass
```

---

## 6. Observability (Production-Ready)

### ✅ Structured Logging

- [ ] All logs use structured format (JSON)
- [ ] Logs include `requestId`, `sessionId`, `jobId` where applicable
- [ ] Sensitive data NOT logged (API keys, tokens)

**Validation**: Sample logs and verify structure.

### ✅ Metrics Exposure

- [ ] `/health` endpoint returns detailed metrics
- [ ] Metrics include event loop lag, memory, active requests
- [ ] Health status degrades under pressure (503 if `isUnderPressure: true`)

**Validation**:

```bash
curl http://localhost:3000/health | jq
# Should return full health object with load + performance metrics
```

### ✅ Error Tracking

- [ ] Errors logged with full context (stack, requestId, etc.)
- [ ] Job failures captured and exposed in `/status`
- [ ] 500 errors rate < 0.1% under normal load

---

## 7. Documentation Updates

### ✅ API Documentation

- [ ] API docs updated for 202 Accepted response (breaking change)
- [ ] `/status` endpoint documented
- [ ] Migration guide for clients (poll status instead of blocking)

### ✅ Performance Analysis

- [ ] `artillery-report-analysis.md` created
- [ ] Analysis includes causal hypotheses + validation plan
- [ ] Recommendations prioritized by impact/effort

### ✅ README/CHANGELOG

- [ ] CHANGELOG.md updated with breaking change note
- [ ] README.md links to performance docs
- [ ] Load testing instructions updated

---

## 8. Pre-Merge Checklist

### ✅ Code Quality

- [ ] `npm run lint` passes (no errors)
- [ ] `npm run format` applied
- [ ] No console.log/debugger statements in production code
- [ ] All TODOs addressed or tracked in issues

### ✅ Commits

- [ ] Commits follow Conventional Commits format
- [ ] Commits are atomic (one logical change per commit)
- [ ] Commit messages reference instrumentation/fix purpose

**Expected commits**:

1. `chore(obs): add request correlation and perf instrumentation`
2. `feat(api): attribute and expose rate limit causes for 429`
3. `perf(api): refactor session finish to async job queue`
4. `test(perf): add targeted regression tests for finish`
5. `test(loadtest): update artillery scenarios for async finish`
6. `docs(api): add performance analysis and validation checklist`

### ✅ CI/CD

- [ ] All CI checks pass (tests, lint, build)
- [ ] Docker build succeeds
- [ ] No new vulnerabilities introduced (npm audit)

---

## 9. Deployment Validation (Staging/Prod)

### ✅ Smoke Tests

- [ ] Session start → upload → finish → status workflow works
- [ ] `/health` endpoint returns 200 (healthy)
- [ ] No 500 errors in logs (first 5 minutes)

### ✅ Load Test (Staging)

- [ ] Run Artillery against staging
- [ ] Verify throughput > 5 req/s
- [ ] Verify finish p95 < 500ms
- [ ] Monitor event loop lag (should stay < 100ms)

### ✅ Monitoring (First Hour)

- [ ] Check error rate (should be < 0.1%)
- [ ] Check 429 rate (should be < 1%)
- [ ] Check memory usage (should be stable)
- [ ] Check job queue stats (no stuck jobs)

---

## Success Criteria Summary

| Criteria        | Target      | Status |
| --------------- | ----------- | ------ |
| Throughput      | > 5 req/s   | ⏳     |
| Finish p95      | < 500ms     | ⏳     |
| 429 rate        | < 1%        | ⏳     |
| Event loop lag  | < 100ms avg | ⏳     |
| All tests pass  | 100%        | ⏳     |
| Zero 500 errors | Smoke test  | ⏳     |

**Sign-off**: Performance fixes validated and ready for production.

---

## Notes

- This checklist is a living document. Update as new performance issues are discovered.
- For each validation, capture evidence (logs, screenshots, metrics) for audit trail.
- If any item fails, investigate root cause before proceeding.
