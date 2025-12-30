# Artillery Load Test - Critical Analysis

## Executive Summary

**Test Conditions**: Single user, sequential workflow, progressive batch sizes (10→1000 notes/session)  
**Observed Issues**:

- Throughput plateau at ~1 req/s
- HTTP 429 responses (backpressure triggered)
- `/api/session/finish` latency: avg >1s, p95 ~1.8s
- Other endpoints (start, upload) remain fast

**Critical Finding**: The bottleneck is NOT the upload phase, but the **session finalization process** which performs synchronous, CPU-intensive operations (markdown rendering, wikilink resolution, indexing) on the Node.js event loop.

---

## What the Test PROVES

### 1. Backpressure Middleware is Functional

**Evidence**: HTTP 429 responses are returned under load  
**Mechanism**: `BackpressureMiddleware` monitors:

- Active concurrent requests (limit: 50)
- Event loop lag (threshold: 200ms)
- Memory usage (threshold: 500MB)

**Implication**: The 429s indicate the server is correctly detecting overload, but the question is **WHY** overload occurs so early (at 1 req/s).

### 2. Finish Endpoint is the Bottleneck

**Evidence**:

- `/api/session/start`: fast (<100ms)
- `/api/session/*/notes/upload`: fast (<200ms)
- `/api/session/*/assets/upload`: fast (<200ms)
- `/api/session/*/finish`: slow (avg >1s, p95 ~1.8s)

**Mechanism**: The finish endpoint executes:

```
1. FinishSessionHandler.handle() - update session status
2. SessionFinalizerService.rebuildFromStored() - HEAVY
   - Load all notes from session storage
   - Detect plugin blocks (Leaflet)
   - Sanitize content (regex cleanup rules)
   - Resolve wikilinks (parse all notes, build graph)
   - Compute routing
   - Render markdown → HTML (markdown-it, synchronous)
   - Write files to disk
   - Rebuild manifest
   - Rebuild search index
3. StagingManager.promoteSession() - copy staging → production
```

**Root Cause**: Steps 2-3 are **synchronous** and performed on the main event loop, blocking all other requests.

### 3. Event Loop Blocking Causes Throughput Plateau

**Hypothesis**: The finish operation blocks the event loop for 1-2 seconds, preventing other requests from being processed.

**Verification Needed**:

- Measure event loop lag during finish (already instrumented in `BackpressureMiddleware`)
- Confirm that event loop lag > 200ms triggers 429s
- Identify which sub-step(s) cause the lag (rendering? I/O? wikilink resolution?)

---

## What the Test DOES NOT Prove

### 1. True Concurrent Load

**Limitation**: Artillery runs 1 user sequentially. We don't know:

- How the system behaves with 10 concurrent users
- Whether concurrent finishes would serialize (mutex?) or crash
- Whether concurrent uploads + finish would trigger memory issues

**Recommendation**: Add a multi-user scenario (5-10 users, staggered starts).

### 2. I/O vs CPU Bottleneck

**Limitation**: Without sub-step timing, we can't differentiate:

- CPU-bound: markdown rendering, wikilink resolution (synchronous ops)
- I/O-bound: file reads/writes, staging promotion (async but sequential)

**Recommendation**: Add instrumentation to measure each sub-step duration.

### 3. Database or External Dependencies

**Limitation**: This app has NO external database. All state is in-memory + filesystem. Therefore:

- No DB contention
- No network latency to external services
- Bottleneck MUST be in application code or filesystem I/O

### 4. Infrastructure Limits

**Limitation**: Test runs on `localhost:3000`. We don't know:

- Docker container resource limits (CPU quota, memory)
- Host machine specs (CPU cores, disk IOPS)
- Reverse proxy overhead (if deployed with nginx/traefik)

**Recommendation**: Document test environment specs (CPU cores, RAM, disk type).

---

## Causal Analysis: Why Throughput Plateaus at 1 req/s

### Hypothesis 1: Event Loop Blocking (MOST LIKELY)

**Mechanism**:

- Finish takes 1-2s of synchronous work
- Event loop blocked → no other requests processed
- Backpressure detects lag > 200ms → returns 429

**Evidence**:

- Finish latency (1-2s) ≈ inverse throughput (1 req/s)
- `BackpressureMiddleware` tracks event loop lag
- Markdown rendering (markdown-it) is synchronous

**Validation**:

- Add timing per sub-step in `SessionFinalizerService`
- Log event loop lag at start/end of finish
- Confirm lag > 200ms during finish

**Fix**:

- Move heavy work to worker threads (markdown rendering, wikilink resolution)
- Return 202 Accepted + progress tracking
- Use async I/O (already using `fs.promises`, but check if anything is sync)

### Hypothesis 2: Filesystem I/O Serialization (POSSIBLE)

**Mechanism**:

- Node.js `fs.promises` uses libuv thread pool (default: 4 threads)
- If finish writes many files sequentially, I/O queue saturates
- Promotion (`stagingManager.promoteSession()`) copies directories recursively

**Evidence**:

- Need to measure I/O wait time vs CPU time
- Check if `fs.rm`, `fs.mkdir`, `fs.copyFile` are awaited properly

**Validation**:

- Profile with `perf` or Node.js profiler
- Check libuv thread pool size: `process.env.UV_THREADPOOL_SIZE`

**Fix**:

- Increase `UV_THREADPOOL_SIZE` to 8-16
- Batch file writes
- Use streams for large file copies

### Hypothesis 3: Memory Pressure (UNLIKELY)

**Mechanism**:

- Loading 1000 notes + rendering HTML → memory spike
- GC pauses → event loop lag

**Evidence**:

- Backpressure triggers on memory > 500MB
- No reports of memory-based 429s in processor logs

**Validation**:

- Track heap usage before/after finish
- Monitor GC pauses (requires `--expose-gc` flag)

**Fix**:

- Stream notes processing (don't load all in memory)
- Increase memory threshold if headroom exists

---

## Protocol Limitations (Artillery)

### Single User Sequential Flow

**Impact**: Test does NOT simulate concurrent requests. Real-world load would have:

- Multiple sessions starting simultaneously
- Overlapping uploads and finishes
- Concurrent reads (frontend fetching content)

**Recommendation**: Add multi-user scenario with `arrivalRate: 5` to test concurrency.

### Think Time

**Current**: 0.2-1s pauses between steps  
**Real-world**: Plugin may batch requests with minimal delay  
**Impact**: Test is OPTIMISTIC (real load may be higher)

**Recommendation**: Add a "stress test" phase with `think: 0` to test worst-case.

### Payload Simulation

**Current**: Artillery sends base64-encoded dummy payloads  
**Real-world**: Actual note content (markdown, wikilinks, images)  
**Impact**: Payload size may be larger/smaller, affecting serialization cost

**Recommendation**: Use realistic payloads from test vault.

---

## Actionable Diagnostics (Next Steps)

### Step 1: Measure Event Loop Lag During Finish

**Tool**: `BackpressureMiddleware` already tracks this  
**Action**: Log lag at start/end of finish, correlate with 429s  
**Expected**: Lag > 200ms during finish

### Step 2: Break Down Finish Timing

**Tool**: Add instrumentation to `SessionFinalizerService.rebuildFromStored()`  
**Action**: Measure duration of:

- Load notes
- Detect plugin blocks
- Sanitize content
- Resolve wikilinks
- Render markdown
- Write files
- Build manifest
- Build search index
- Promote staging

**Expected**: Identify 1-2 sub-steps consuming 80% of time

### Step 3: Profile CPU vs I/O

**Tool**: Node.js `--prof` flag or `clinic.js`  
**Action**: Run Artillery with profiler, analyze flame graph  
**Expected**: Identify hot functions (likely markdown-it or wikilink resolution)

### Step 4: Test Worker Thread Offload

**Tool**: Node.js `worker_threads`  
**Action**: Move markdown rendering to worker, measure latency improvement  
**Expected**: Finish p95 < 500ms, throughput > 5 req/s

---

## Recommended Fixes (Prioritized)

### Priority 1: Offload Finish to Background Job

**Impact**: High (reduces blocking, improves throughput)  
**Effort**: Medium (requires job queue + progress tracking)  
**Approach**:

- Return 202 Accepted immediately
- Queue finish job (in-memory for MVP, Redis for prod)
- Add `/api/session/:id/status` endpoint
- Use worker threads for heavy ops

### Priority 2: Instrument Finish Sub-Steps

**Impact**: High (provides actionable data)  
**Effort**: Low (add timing logs)  
**Approach**:

- Wrap each sub-step with `performance.now()`
- Log duration + bytes processed
- Expose in structured logs + metrics

### Priority 3: Optimize Markdown Rendering

**Impact**: Medium (depends on profiling results)  
**Effort**: Medium (refactor to use workers)  
**Approach**:

- Move `MarkdownItRenderer` calls to worker thread
- Batch notes for rendering (reduce thread spawn overhead)
- Consider caching rendered HTML (if notes don't change)

### Priority 4: Increase UV_THREADPOOL_SIZE

**Impact**: Low-Medium (helps if I/O-bound)  
**Effort**: Low (env var)  
**Approach**:

- Set `UV_THREADPOOL_SIZE=16` in Docker
- Measure impact on I/O-heavy operations

### Priority 5: Add Request Correlation

**Impact**: Medium (improves observability)  
**Effort**: Low (middleware + logging)  
**Approach**:

- Generate `x-request-id` if not present
- Propagate through all logs
- Return in response headers

---

## Verification Plan

### Before Changes (Baseline)

1. Run Artillery with current code
2. Capture metrics:
   - Throughput (req/s)
   - P95 latency per endpoint
   - 429 count + cause (from logs)
   - Event loop lag (from logs)
3. Profile with `clinic.js` or `--prof`

### After Each Change

1. Run same Artillery scenario
2. Compare metrics vs baseline
3. Verify no regressions (error rate, p99)
4. Document improvement % and cost

### Success Criteria

- Throughput > 5 req/s for 200-note sessions
- Finish p95 < 500ms
- 429 rate < 1% (only under extreme load)
- Event loop lag < 100ms average

---

## Conclusion

The test reveals a **design bottleneck**: the finish endpoint performs synchronous, CPU-intensive work on the main event loop, blocking all other requests and causing artificial throughput limits.

**Root Cause**: Synchronous markdown rendering + wikilink resolution  
**Immediate Fix**: Offload to worker threads + return 202 Accepted  
**Long-Term Fix**: Incremental processing (render during upload, not at finish)

The backpressure mechanism works correctly, but it's protecting against a **self-inflicted bottleneck** rather than external load. Fixing the finish operation will unlock significantly higher throughput without requiring infrastructure changes.
