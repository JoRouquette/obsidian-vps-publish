#!/bin/bash
# Performance Enhancement Commits
# Run from repo root: bash scripts/perf-commits.sh

set -e

echo "Creating atomic commits for performance enhancements..."

# Reset staging
git reset HEAD .

# Commit 1: Request correlation middleware
echo "[1/8] Committing request correlation middleware..."
git add apps/node/src/infra/http/express/middleware/request-correlation.middleware.ts
git add apps/node/src/infra/http/express/middleware/_tests/request-correlation.middleware.test.ts
# Add only request correlation parts of app.ts (import + usage)
git add -p apps/node/src/infra/http/express/app.ts << EOF
y
n
n
n
n
EOF
git commit -m "chore(obs): add request correlation middleware for distributed tracing

- Generate or extract x-request-id for all requests
- Propagate request ID through logs
- Return x-request-id in response headers
- Support multiple header formats (x-request-id, x-correlation-id, x-trace-id)
- Add unit tests for middleware"

# Commit 2: Backpressure attribution
echo "[2/8] Committing backpressure attribution..."
git add apps/node/src/infra/http/express/middleware/backpressure.middleware.ts
git commit -m "feat(api): attribute and expose rate limit causes for 429 responses

- Add explicit cause field: active_requests | event_loop_lag | memory_pressure
- Add source field: 'app' (distinguish from upstream rate limiting)
- Include RFC-compliant Retry-After header
- Add X-RateLimit-* headers for client awareness
- Include requestId in all 429 responses for correlation
- Log 429 with full context (cause, requestId, metrics)"

# Commit 3: Session finalization timing
echo "[3/8] Committing session finalization timing breakdown..."
git add apps/node/src/infra/sessions/session-finalizer.service.ts
git commit -m "chore(obs): add detailed timing breakdown for session finalization

- Instrument 12 steps in rebuildFromStored()
- Log duration + percentage of total time per step
- Identify performance bottlenecks (e.g., rendering, wikilink resolution)
- Logged as [PERF] Session rebuild completed with full metrics"

# Commit 4: Enhanced health endpoint
echo "[4/8] Committing enhanced health endpoint..."
git add apps/node/src/infra/http/express/controllers/health-check.controller.ts
# Add health controller integration in app.ts
git add -p apps/node/src/infra/http/express/app.ts << EOF
n
y
EOF
git commit -m "feat(api): expose event loop lag and load metrics in health endpoint

- Return detailed health metrics (memory, load, performance)
- Expose event loop lag in real-time
- Return 503 Service Unavailable when under pressure
- Include active requests, slow request count
- Add performance summary (avg/max/min duration)
- Enable monitoring/alerting integration"

# Commit 5: Async finalization (breaking change)
echo "[5/8] Committing async session finalization..."
git add apps/node/src/infra/sessions/session-finalization-job.service.ts
git add apps/node/src/infra/http/express/controllers/session-controller.ts
git add apps/node/src/infra/http/express/app.ts
git commit -m "perf(api): refactor session finish to async job queue

BREAKING CHANGE: POST /api/session/:id/finish now returns 202 Accepted
with jobId. Clients must poll GET /api/session/:id/status for completion.

- Add SessionFinalizationJobService for background processing
- Queue heavy rebuild/promotion work (non-blocking)
- Return 202 Accepted immediately with jobId + statusUrl
- New endpoint: GET /api/session/:id/status for progress tracking
- Sequential job processing (avoid concurrent finalization)
- Auto-cleanup old jobs (1 hour retention)

Expected impact:
- Throughput: 1 req/s → 5+ req/s (5x improvement)
- Finish p95: 1800ms → <50ms HTTP response
- Event loop: No longer blocked by finalization"

# Commit 6: Artillery updates
echo "[6/8] Committing Artillery test updates..."
git add artillery-load-test.yml
git add artillery-processor.js
git commit -m "test(loadtest): update artillery scenarios for async finish workflow

- Capture x-request-id from all responses
- Log 429 cause + source + requestId
- Poll /status endpoint after /finish (max 60 attempts)
- Track job completion metrics (job.completed, job.failed)
- Measure full job completion time (not just HTTP response)
- Add checkJobCompletion processor function"

# Commit 7: Performance tests
echo "[7/8] Committing performance regression tests..."
git add apps/node/src/infra/sessions/_tests/
git commit -m "test(perf): add regression tests for session finalization latency

- Test small (50 notes), medium (100), large (300) batches
- Verify p95 < configured thresholds
- Disabled by default (opt-in with ENABLE_PERF_TESTS=true)
- Configurable thresholds via environment variables
- Prevent performance regressions in CI"

# Commit 8: Documentation
echo "[8/8] Committing documentation..."
git add docs/api/performance/
git commit -m "docs(api): add performance analysis and validation checklist

- Add artillery-report-analysis.md (critical analysis of bottlenecks)
- Add validation-checklist.md (pre-deployment verification)
- Add IMPLEMENTATION.md (summary of all changes)
- Add performance/README.md (index + quick start)
- Document expected impact (5x throughput improvement)
- Include migration guide for plugin (breaking change)"

echo ""
echo "✅ All commits created successfully!"
echo ""
echo "Commit log:"
git log --oneline -8
echo ""
echo "To push: git push origin $(git branch --show-current)"
