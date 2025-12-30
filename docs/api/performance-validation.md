# Phase 5: Automated Performance Testing & Validation

## Overview

This phase implements automated testing and validation mechanisms to ensure performance optimizations work as expected and prevent future regressions.

## Implemented Components

### 1. Performance Smoke Tests (Plugin)

**File**: [apps/obsidian-vps-publish/src/\_tests/performance.smoke.test.ts](apps/obsidian-vps-publish/src/_tests/performance.smoke.test.ts)

**Purpose**: Unit tests that verify `UiPressureMonitorAdapter` tracking and enforce performance thresholds.

**Key Tests**:

- ✅ Tracks blocking operations (> 50ms)
- ✅ Calculates progress updates per second
- ✅ Tracks notice creation frequency
- ✅ Enforces thresholds:
  - < 10 blocking operations
  - < 200ms longest block
  - < 15 progress updates/sec
  - < 10 notices/sec

**Run**:

```bash
npm run test -- apps/obsidian-vps-publish/src/_tests/performance.smoke.test.ts
```

### 2. Backpressure Middleware Tests (API)

**File**: [apps/node/src/infra/http/express/middleware/\_tests/backpressure.middleware.test.ts](apps/node/src/infra/http/express/middleware/_tests/backpressure.middleware.test.ts)

**Purpose**: Unit tests that verify `BackpressureMiddleware` correctly rejects requests under high load.

**Key Tests**:

- ✅ Allows requests under threshold
- ✅ Rejects requests when max active requests exceeded
- ✅ Returns 429 with retry information
- ✅ Tracks event loop lag over time
- ✅ Monitors memory usage
- ✅ Recovers after load spike

**Run**:

```bash
npm run test -- apps/node/src/infra/http/express/middleware/_tests/backpressure.middleware.test.ts
```

### 3. Performance Validation Script

**File**: [scripts/validate-performance.mjs](scripts/validate-performance.mjs)

**Purpose**: Automated script that validates all performance optimizations are present and integrated.

**Checks**:

1. ✅ Unit tests pass
2. ✅ Build succeeds
3. ✅ All optimization files exist:
   - throttle.util.ts
   - yield-scheduler.util.ts
   - backpressure.middleware.ts
   - request-with-retry.util.ts
   - ui-pressure-monitor.adapter.ts
   - performance-monitoring.middleware.ts
4. ✅ Optimizations are used in key files:
   - NoticeProgressAdapter uses throttle
   - NoticeNotificationAdapter uses debounce/coalesce
   - ObsidianCompressionAdapter uses YieldScheduler
   - SessionApiClient uses requestUrlWithRetry
   - Express app uses BackpressureMiddleware

**Usage**:

```bash
# Development mode (relaxed thresholds)
npm run perf:validate

# CI mode (strict thresholds)
npm run perf:validate:strict
```

**Exit codes**:

- `0` - All validations passed
- `1` - Performance regression detected
- `2` - Script error (missing files, build failure, etc.)

### 4. NPM Scripts

Added to `package.json`:

```json
{
  "scripts": {
    "perf:validate": "node scripts/validate-performance.mjs",
    "perf:validate:strict": "node scripts/validate-performance.mjs --strict"
  }
}
```

## Performance Thresholds

### Relaxed Mode (Development)

Suitable for local development and manual testing:

| Metric               | Threshold | Description                          |
| -------------------- | --------- | ------------------------------------ |
| Blocking operations  | ≤ 10      | Operations > 50ms                    |
| Longest block (ms)   | ≤ 200     | Max duration of any single operation |
| Progress updates/sec | ≤ 15      | After throttling (100ms)             |
| Notices/sec          | ≤ 10      | After coalescence (300ms)            |
| Event loop lag (ms)  | ≤ 100     | API server responsiveness            |

### Strict Mode (CI)

Enforced in continuous integration:

| Metric               | Threshold | Description                          |
| -------------------- | --------- | ------------------------------------ |
| Blocking operations  | ≤ 5       | Operations > 50ms                    |
| Longest block (ms)   | ≤ 100     | Max duration of any single operation |
| Progress updates/sec | ≤ 12      | After throttling (100ms)             |
| Notices/sec          | ≤ 8       | After coalescence (300ms)            |
| Event loop lag (ms)  | ≤ 80      | API server responsiveness            |

## CI Integration

### GitHub Actions Workflow (Recommended)

Add to `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  performance-validation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci --no-audit --no-fund

      - name: Run performance validation (strict)
        run: npm run perf:validate:strict
```

This ensures:

- All unit tests pass
- Build succeeds
- All optimization files present
- Optimizations properly integrated
- No performance regressions introduced

## Manual Testing Workflow

For comprehensive end-to-end validation:

### 1. Generate Synthetic Vault

```bash
node scripts/generate-test-vault.mjs --notes 500 --assets 100
```

### 2. Configure Obsidian Plugin

- Open generated vault in Obsidian
- Enable plugin with debug logging
- Configure VPS connection

### 3. Run Publish

- Initiate publish
- Monitor console for metrics

### 4. Verify Metrics

Check "UI Pressure Summary" at end:

```
UI Pressure Summary:
  Total Progress Updates: 150
  Total Notices: 45
  Blocking Operations: 3
  Longest Block: 85ms
  Progress Updates/sec: 12.5
  Notices/sec: 3.8
```

Expected results (500 notes, 100 assets):

- ✅ Blocking operations: 0-5
- ✅ Longest block: < 100ms
- ✅ Progress updates/sec: < 15
- ✅ Notices/sec: < 10

### 5. Check API Logs

Look for `[BACKPRESSURE]` warnings:

- Should be absent under normal load
- If present: increase server limits or reduce publish concurrency

### 6. Verify Retry Behavior

If 429 errors occur:

- Plugin should log: `[HTTP] Server backpressure detected, retrying`
- Retry delay: 5s → 10s → 20s (max 3 attempts)
- User should see: "Server under load, retry in Xs"

## Regression Detection

### Automated (CI)

`npm run perf:validate:strict` will exit with code `1` if:

- Unit tests fail
- Build fails
- Optimization files missing
- Optimizations not integrated

### Manual (Post-Publish)

Compare metrics with baselines:

| Metric               | Baseline (500 notes) | Tolerance | Action if Exceeded         |
| -------------------- | -------------------- | --------- | -------------------------- |
| Blocking ops         | 0-5                  | > 10      | Investigate, profile       |
| Longest block (ms)   | 50-100               | > 200     | Add more yielding          |
| Progress updates/sec | 8-12                 | > 20      | Verify throttle working    |
| Notices/sec          | 2-5                  | > 15      | Verify coalescence working |

## Troubleshooting

### Tests Failing

**Symptom**: `npm test` fails with timeout errors

**Solution**:

- Check that async operations properly await
- Verify YieldScheduler is used in long loops
- Ensure throttle/debounce functions are created correctly

### Validation Script Fails

**Symptom**: `npm run perf:validate` exits with code `1` or `2`

**Check**:

1. File existence: All optimization files present?
2. Integration: Are optimizations actually used in code?
3. Build: Does `npm run build` succeed?
4. Tests: Does `npm test` succeed?

### High Metrics in Production

**Symptom**: Real-world metrics exceed thresholds

**Actions**:

1. Check vault size: > 1000 notes may need adjusted settings
2. Increase concurrency limits in plugin settings
3. Profile with Chrome DevTools to find hotspots
4. Verify network latency (upload time dominates?)

## Future Enhancements

### Phase 5+ (Optional)

1. **Benchmarking Suite**
   - Automated before/after comparison
   - Track metrics over time (historical data)
   - Generate performance reports

2. **Profiling Integration**
   - CPU profiling snapshots
   - Memory heap snapshots
   - Flame graphs for hotspot identification

3. **Load Testing (API)**
   - Simulate concurrent uploads (10+ clients)
   - Verify backpressure triggers correctly
   - Measure recovery time after spike

4. **E2E Performance Tests**
   - Playwright tests that measure actual UI responsiveness
   - Assert on frame rate during publish
   - Verify progress bar updates smoothly

## Summary

Phase 5 provides:

- ✅ Automated smoke tests (unit level)
- ✅ Validation script (integration level)
- ✅ CI-ready checks (strict thresholds)
- ✅ Manual testing workflow (end-to-end)
- ✅ Regression detection mechanisms
- ✅ Clear thresholds and expectations

This ensures performance optimizations remain effective as the codebase evolves.
