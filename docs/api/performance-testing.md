# Performance Testing & Validation Guide

This guide helps you test and validate the performance improvements made to handle large vault uploads.

## Quick Start: Test Performance Improvements

### 1. Generate a Test Vault

```bash
# From project root
node scripts/generate-test-vault.mjs --notes 500 --assets 100 --output test-files/large-vault
```

This creates a realistic test vault with:

- 500 markdown notes (various sizes, frontmatter, tags)
- 100 dummy image assets (PNG format)
- Wikilinks between notes
- Dataview blocks (10% of notes)
- Some notes marked `publish: false` (10%)

### 2. Open Test Vault in Obsidian

1. Launch Obsidian
2. **Open folder as vault** → select `test-files/large-vault`
3. If prompted to enable Safe Mode, choose **Turn off Safe Mode**

### 3. Configure VPS Publish Plugin

1. Enable the **VPS Publish** plugin (Community Plugins)
2. Open plugin settings
3. Configure your VPS:
   - **Base URL**: Your API endpoint
   - **API Key**: Your authentication key
   - **Folders**: Select `Notes` folder from the test vault
   - **Log Level**: Set to **`debug`** (critical for performance metrics)

### 4. Run Publish & Monitor

1. Click the **rocket icon** in the ribbon (or use command palette)
2. Select your configured VPS
3. Publishing starts immediately

**What to monitor**:

- **Obsidian UI**: Try moving the window, clicking buttons → should remain responsive
- **Console** (Ctrl+Shift+I):
  - Look for `📊 Performance Summary` at the end
  - Look for `🎯 UI Pressure Summary`
  - Check for warnings (⚠️)

### 5. Analyze Results

#### Expected Output (Console)

```
📊 Performance Summary ===
  publishing-session: 25000ms total (1x, avg 25000ms)
    → totalDurationMs=25000, notesPublished=450, assetsPublished=90
  parse-vault: 2000ms total (1x, avg 2000ms)
    → notesCollected=500, publishableNotes=450
  ...

🎯 UI Pressure Summary ===
Total progress updates: 145
Total notices created: 8
Average progress update interval: 172.41ms
Current progress updates/sec: 2 (last 1 second window)
Current notices/sec: 0 (last 1 second window)

Blocking operations detected: 3
Longest blocking operation: 87.23ms

Top 5 longest blocking operations:
  - 87.23ms (dataview processing)
  - 56.12ms (vault scan)
  - 45.67ms (asset encoding)
```

#### ✅ Good Metrics (500-note vault)

| Metric               | Target  | Meaning                  |
| -------------------- | ------- | ------------------------ |
| Total publish time   | < 30s   | Depends on network speed |
| Progress updates/sec | < 10    | UI not spammed           |
| Notices/sec          | < 2     | Not too many popups      |
| Longest block        | < 100ms | No major UI freeze       |
| Blocking ops count   | < 10    | Few synchronous delays   |

#### ⚠️ Warning Signs

- **High progress update rate (>10/sec)**: May indicate throttling needed
- **Many notices (>20)**: Too chatty, should coalesce
- **Long blocking ops (>200ms)**: Synchronous work needs chunking
- **Event loop lag (>100ms)**: API under stress or CPU bottleneck

## Configuration Tuning (Advanced)

New settings are available in `data.json` (plugin data folder):

```json
{
  "maxConcurrentDataviewNotes": 5,
  "maxConcurrentUploads": 3,
  "maxConcurrentFileReads": 5
}
```

### When to Adjust

#### High-end Machine (fast CPU, good network)

- Increase `maxConcurrentUploads` to `5` or `6`
- Increase `maxConcurrentDataviewNotes` to `8` or `10`
- **Benefit**: Faster uploads
- **Risk**: Higher memory usage, potential UI lag if too aggressive

#### Low-end Machine (older CPU, slow network)

- Decrease `maxConcurrentUploads` to `2`
- Decrease `maxConcurrentDataviewNotes` to `3`
- **Benefit**: More UI responsiveness
- **Trade-off**: Slower overall publish time

#### Default Values (recommended for most users)

- `maxConcurrentDataviewNotes: 5` → Balanced for typical vaults
- `maxConcurrentUploads: 3` → Conservative, stable
- `maxConcurrentFileReads: 5` → Matches dataview concurrency

## Troubleshooting

### UI Still Freezes During Publish

**Possible causes**:

1. **Dataview plugin slow**: Disable Dataview plugin temporarily and re-test
2. **Large individual notes**: If a single note has huge dataview queries, it may block
3. **Network congestion**: Check network speed, increase chunk size

**Actions**:

- Lower concurrency: `maxConcurrentDataviewNotes: 3`
- Check console for "Blocking operations" > 200ms
- Report issue with console logs attached

### Publish Fails or Times Out

**Possible causes**:

1. **API overloaded**: Check API logs for event-loop lag warnings
2. **Network timeout**: Increase timeout in API (not yet configurable)
3. **Memory exhaustion**: Check API `heapUsed` in performance summary

**Actions**:

- Reduce upload concurrency: `maxConcurrentUploads: 2`
- Check API `PerformanceMonitoringMiddleware` output
- Monitor API with `docker stats` or equivalent

### Console Shows Many Warnings

Example warnings and their meaning:

```
⚠️ WARNING: High progress update rate (15/sec)
```

→ Progress bar is updated too frequently, may cause lag

```
⚠️ WARNING: High notice creation rate (5/sec)
```

→ Too many popups, user experience degraded

```
⚠️ WARNING: Very long blocking operation detected (234.56ms)
```

→ A synchronous operation took too long, UI froze temporarily

**Actions**: Report these on GitHub Issues with:

- Vault size (number of notes/assets)
- Full console log output
- System specs (CPU, RAM)

## Generating Different Test Scenarios

### Small Vault (Quick Test)

```bash
node scripts/generate-test-vault.mjs --notes 50 --assets 10
```

- Fast publish (< 5s)
- Good for smoke testing

### Medium Vault (Typical User)

```bash
node scripts/generate-test-vault.mjs --notes 200 --assets 50
```

- Realistic for personal knowledge bases
- Publish time: ~10-15s

### Large Vault (Stress Test)

```bash
node scripts/generate-test-vault.mjs --notes 1000 --assets 368
```

- Matches your reported scenario
- Publish time: ~30-60s (depends on network)
- Use this to verify no UI freeze

### Extreme Vault (Edge Case)

```bash
node scripts/generate-test-vault.mjs --notes 5000 --assets 1000
```

- Beyond typical use case
- Publish time: several minutes
- May reveal edge cases (memory, timeout)

## Automated Testing (Future)

Planned enhancements:

- CI performance regression tests
- Benchmark suite with fixed test vaults
- Automated metrics collection and comparison

For now, manual testing with synthetic vaults is the recommended approach.

## Reporting Performance Issues

When reporting performance problems, please include:

1. **Vault size**:
   - Number of notes
   - Number of assets
   - Average note size

2. **System specs**:
   - OS (Windows/macOS/Linux)
   - CPU model
   - RAM amount
   - Obsidian version

3. **Console logs**:
   - Full "Performance Summary" output
   - Full "UI Pressure Summary" output
   - Any error messages

4. **Settings** (if customized):
   - `maxConcurrentDataviewNotes`
   - `maxConcurrentUploads`
   - `logLevel`

5. **Symptoms**:
   - Describe the freeze/lag (duration, frequency)
   - Steps to reproduce

Submit issues to: [GitHub Issues](https://github.com/JoRouquette/obsidian-vps-publish/issues)
