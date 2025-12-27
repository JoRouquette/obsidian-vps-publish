# Performance Documentation Index

This directory contains performance analysis, optimization documentation, and validation procedures for the API.

## Documents

### [Artillery Report Analysis](./artillery-report-analysis.md)

**Critical analysis of load test results**

- What the test proves (and doesn't prove)
- Causal analysis of bottlenecks
- Recommended fixes (prioritized)
- Verification plan

**When to read**: After running Artillery tests, before implementing performance fixes.

### [Validation Checklist](./validation-checklist.md)

**Pre-deployment verification checklist**

- Instrumentation verification (request correlation, timing, metrics)
- Backpressure attribution (429 transparency)
- Async session finalization validation
- Performance metrics (Artillery baseline vs after)
- Regression tests
- Observability checks

**When to use**: Before merging performance fixes, before deploying to production.

## Related Documentation

- [Load Testing Guide](../load-testing.md) - How to run Artillery tests
- [Performance Enhancements](../performance-enhancements.md) - Historical performance improvements
- [Performance Testing](../performance-testing.md) - Testing strategies
- [Logging](../logging.md) - Structured logging patterns

## Quick Start

### Run Load Test

```bash
# Set API key
export API_KEY=your-api-key

# Run Artillery
npm run artillery:test

# Or with custom config
artillery run artillery-load-test.yml --output report.json
artillery report report.json
```

### Validate Performance Fixes

```bash
# 1. Run baseline before changes
npm run artillery:baseline > baseline.json

# 2. Apply performance fixes

# 3. Run tests again
npm run artillery:test > after-changes.json

# 4. Compare results
npm run artillery:compare baseline.json after-changes.json

# 5. Run regression tests
ENABLE_PERF_TESTS=true npm test -- session-finalization-perf.test.ts

# 6. Check health metrics
curl http://localhost:3000/health | jq
```

### Debug Performance Issues

```bash
# 1. Enable detailed logging
export LOGGER_LEVEL=debug

# 2. Start server
npm run start node

# 3. Trigger problematic workflow

# 4. Check logs for [PERF] entries
# Look for timing breakdowns in session finalization

# 5. Check event loop lag
curl http://localhost:3000/health | jq '.load.eventLoopLagMs'

# 6. Profile with Node.js built-in profiler
node --prof dist/apps/node/main.js
# Generate flamegraph
node --prof-process isolate-*.log > profile.txt
```

## Performance Targets

| Metric             | Target      | Measurement                    |
| ------------------ | ----------- | ------------------------------ |
| Throughput         | > 5 req/s   | Artillery sustained load phase |
| Session finish p95 | < 500ms     | Artillery `/finish` latency    |
| Event loop lag     | < 100ms avg | `/health` endpoint             |
| 429 rate           | < 1%        | Artillery error rate           |
| Memory usage       | < 500MB     | `/health` endpoint             |

## Performance Fixes Applied

### 2024-12 (Current)

1. **Request correlation** - Added `x-request-id` for distributed tracing
2. **429 attribution** - Explicit cause (active_requests|event_loop_lag|memory_pressure)
3. **Finish timing breakdown** - Per-step instrumentation in SessionFinalizerService
4. **Async finalization** - Job queue + 202 Accepted (non-blocking)
5. **Enhanced health checks** - Event loop lag + load metrics

### Expected Impact

- **Throughput**: 1 req/s → 5+ req/s (5x improvement)
- **Finish p95**: 1800ms → <500ms (72% reduction)
- **Event loop lag**: Reduced blocking, smoother request handling

## Troubleshooting

### High Event Loop Lag (> 200ms)

**Symptoms**: 429 responses with `cause: event_loop_lag`

**Diagnosis**:

1. Check finish timing breakdown - which step is blocking?
2. Profile with `--prof` to identify hot functions
3. Check if markdown rendering is synchronous (should be offloaded)

**Fixes**:

- Move heavy CPU work to worker threads
- Use async I/O (no `fs.readFileSync`, etc.)
- Batch operations to reduce event loop iterations

### High 429 Rate (> 5%)

**Symptoms**: Many requests rejected under moderate load

**Diagnosis**:

1. Check 429 logs for `cause` field
2. Verify backpressure thresholds are appropriate
3. Check if legitimate load or spike/attack

**Fixes**:

- If `active_requests`: Increase `maxActiveRequests` threshold
- If `event_loop_lag`: Fix blocking operations (see above)
- If `memory_pressure`: Optimize memory usage or increase limit

### Slow Session Finish (p95 > 1s)

**Symptoms**: Artillery shows high finish latency

**Diagnosis**:

1. Check logs for `[PERF] Session rebuild completed` with timing breakdown
2. Identify slowest steps (> 30% of total time)
3. Check if staging promotion is slow (I/O bound)

**Fixes**:

- Optimize identified slow steps (rendering, wikilink resolution, indexing)
- Use worker threads for CPU-heavy operations
- Batch file I/O operations
- Consider incremental processing (process during upload, not at finish)

## References

- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
- [Artillery Documentation](https://www.artillery.io/docs)
- [Express.js Performance Tips](https://expressjs.com/en/advanced/best-practice-performance.html)
