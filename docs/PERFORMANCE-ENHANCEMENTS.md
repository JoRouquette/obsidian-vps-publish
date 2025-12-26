# Performance Enhancements - Implementation Summary

## Context

Large vault uploads (500+ notes, 300+ assets) caused significant UI freezing in Obsidian due to:

1. **Unbounded concurrency**: `Promise.all` on hundreds of operations
2. **Insufficient yielding**: Long synchronous loops blocking event loop
3. **No backpressure**: Unlimited parallel network requests
4. **Lack of observability**: No metrics to diagnose bottlenecks

## Phase 1: Instrumentation (Observation only - no fixes)

### Plugin Instrumentation

- **UiPressureMonitorAdapter**: Tracks UI responsiveness metrics
  - Progress updates/sec, notices/sec
  - Blocking operations > 50ms with context
  - Logged at end of publish session

### API Instrumentation

- **PerformanceMonitoringMiddleware**: Tracks API health
  - Request duration, bytes in/out
  - Memory usage (heap)
  - Event loop lag (exponential moving average)
  - Logged per-request if slow (>500ms) or error

### Test Infrastructure

- **scripts/generate-test-vault.mjs**: Synthetic vault generator
  - Configurable notes/assets count
  - Realistic content (dataview, wikilinks, frontmatter, tags)
  - Usage: `node scripts/generate-test-vault.mjs --notes 500 --assets 100`

## Phase 2: Diagnosis (Analysis of metrics)

Key findings from instrumentation:

1. **Dataview processing**: Unbounded `Promise.all(notes.map(...))` → hundreds of concurrent operations
2. **Upload concurrency**: Hardcoded to 3 batches, but each batch can be large
3. **Asset preparation**: Hardcoded concurrency (5), but should be tunable
4. **Existing yielding**: Already present in many places (vault scan, parse handler, dataview blocks)

## Phase 3: Fixes (Anti-freeze corrections)

### 3.1-3.2: Controlled Concurrency

#### ❌ Before (dataviewProcessor)

```typescript
return Promise.all(
  notes.map(async (note) => {
    // Process note...
  })
);
```

- Spawns N concurrent operations (N = number of notes with dataview)
- No yielding between notes
- Can easily reach 100+ concurrent operations on large vaults

#### ✅ After (dataviewProcessor)

```typescript
await processWithControlledConcurrency(
  notes,
  async (note) => {
    /* Process note */
  },
  {
    concurrency: settings.maxConcurrentDataviewNotes || 5,
    yieldEveryN: 5,
  }
);
```

- Max 5 concurrent dataview executions (configurable)
- Yields to UI every 5 notes
- Prevents event loop saturation

#### Uploaders

- **NotesUploaderAdapter**: Now accepts `concurrencyLimit` (default: 3)
- **AssetsUploaderAdapter**: Now accepts `concurrencyLimit` (default: 3)
- Both use `settings.maxConcurrentUploads`
- Asset file reads respect same limit

#### New Settings (Advanced)

```typescript
type PluginSettings = {
  // ...existing settings
  maxConcurrentDataviewNotes?: number; // Default: 5
  maxConcurrentUploads?: number; // Default: 3
  maxConcurrentFileReads?: number; // Default: 5 (currently unused, reserved)
};
```

### Impact Summary

| Metric                  | Before             | After                     | Improvement    |
| ----------------------- | ------------------ | ------------------------- | -------------- |
| Concurrent dataview ops | Unbounded (100+)   | Max 5                     | ~95% reduction |
| UI freeze risk          | High (no yielding) | Low (yield every 5 notes) | Significant    |
| Upload concurrency      | Hardcoded 3        | Configurable (3)          | Tunable        |
| Observability           | None               | Full metrics              | Debuggable     |

## What's NOT Fixed Yet (Future work)

### Phase 3.3: Progress/Notice Throttling

- Currently: Every batch completion triggers a progress update
- Issue: On large uploads, can still generate many updates/sec
- TODO: Implement throttle (100ms) and coalesce updates

### Phase 3.4: CPU-Intensive Operations

- Compression/encoding currently synchronous within chunkedUploadService
- TODO: If profiling shows this as bottleneck, chunk compression work

### Phase 3.5: Cancellation Robustness

- AbortController exists and is passed through pipeline
- TODO: Verify all async operations properly respect cancellation

### Phase 4: API Performance

- TODO: Add backpressure if API shows memory/event-loop issues
- TODO: Stream-based uploads if chunk assembly is costly

## Testing & Validation

### Manual Testing

1. Generate synthetic vault:

   ```bash
   node scripts/generate-test-vault.mjs --notes 500 --assets 100
   ```

2. Open in Obsidian, configure plugin with debug logging

3. Run publish and monitor:
   - Console: "Performance Summary" and "UI Pressure Summary"
   - UI: Check for freezes (cursor responsiveness, modal interactions)

### Expected Metrics (500-note vault)

- **Total publish time**: < 30s (depends on network)
- **UI responsiveness**: No freezes > 100ms
- **Progress updates**: < 10/sec
- **Blocking operations**: < 5 total, all < 100ms

### Regression Detection

- If blocking operations > 10 or longestBlockMs > 200ms: investigate
- If event loop lag > 100ms sustained: API under stress
- If progressUpdatesPerSecond > 20: throttling needed

## Architecture Notes

### Why processWithControlledConcurrency?

- Already existed in `@core-application/utils/concurrency.util`
- Provides:
  - Concurrency limiting (p-limit pattern)
  - Periodic yielding via `yieldEveryN`
  - Progress callbacks
  - Cancellation support

### Why Not Just Reduce Defaults Further?

- Concurrency=1 would be too slow (serial processing)
- Current defaults (3-5) balance responsiveness and throughput
- Users with high-end machines can increase via settings

### Clean Architecture Compliance

- Settings changes: Plugin layer only (no domain changes)
- Uploaders: Infrastructure adapters accept optional concurrency param
- No BREAKING CHANGE: Defaults maintain existing behavior

## Commit History

1. `test(plugin,api): add performance instrumentation and synthetic vault generator` - Phase 1
2. `perf(plugin): add configurable concurrency limits to prevent UI freeze` - Phase 3.1-3.2

## Next Steps (if needed)

1. Collect real-world metrics from users with large vaults
2. If UI pressure warnings persist: implement Phase 3.3 (throttling)
3. If API event-loop lag detected: implement Phase 4 (streaming/backpressure)
4. Add automated performance regression tests in CI
