# Performance Analysis (Phase 1 - Instrumentation)

## Purpose

This document captures the results of Phase 1 performance instrumentation, identifying hotspots that cause UI freezes during Obsidian plugin publishing operations. It serves as the foundation for Phase 2 optimization work.

## Instrumentation Approach

### Event Loop Lag Monitor

Measures JavaScript event loop responsiveness by tracking timer drift:

- **Sampling frequency**: 100ms intervals
- **Metrics tracked**: min, max, avg, p50, p95, p99 lag
- **Interpretation**: High p95/p99 lag (>200ms) indicates UI-blocking operations

### Publishing Trace Service

Centralized step timing with correlation:

- **uploadRunId**: UUID propagated through all logs for correlation
- **Step timing**: Performance.now() before/after each major step
- **Checkpoint tracking**: Intermediate measurements within steps

### Traced Workflow Steps

The publishing workflow is instrumented with 9 primary steps:

1. **parse-vault-init**: Create vault adapter and prepare config
2. **collect-notes**: Read all markdown files from vault folders
3. **check-dataview**: Detect and validate Dataview plugin availability
4. **build-parse-handler**: Instantiate parsing pipeline with services
5. **parse-content**: Full content parsing (frontmatter, wikilinks, assets, dataview, etc.)
6. **session-start**: Initialize upload session, load callout styles, build index configs
7. **upload-notes**: Batch upload notes to server
8. **upload-assets**: Batch upload assets to server
9. **finalize-session**: Commit session and update manifest

## Key Concepts

### What Causes UI Freeze?

The JavaScript event loop processes tasks sequentially in a single thread:

- **Synchronous CPU work**: Heavy parsing, regex, transformations block the loop
- **Synchronous I/O**: File reads without yielding block the loop
- **Large iterations**: Processing 300+ notes without yielding creates long blocking periods

**Symptom**: UI becomes unresponsive, clicks/keypresses ignored, animations freeze

### Event Loop Lag as a Diagnostic

- **<50ms lag**: Excellent, UI feels smooth
- **50-100ms lag**: Acceptable, minor perceptible delay
- **100-200ms lag**: Noticeable jank, UI feels sluggish
- **>200ms lag**: Severe freeze, users perceive as "hung"

## Observed Hotspots (Preliminary Findings)

> **Note**: This section will be updated with real measurements from a ~368-note vault once the plugin is tested with `enablePerformanceDebug: true`.

### Expected Hotspots (Hypotheses)

Based on code review, the following steps are likely candidates for optimization:

1. **collect-notes (Step 2)**:
   - Reads all markdown files synchronously via Obsidian Vault API
   - Parses frontmatter via metadataCache
   - Strips YAML frontmatter with regex
   - Current mitigation: Yields every 10 files

2. **parse-content (Step 5)**:
   - Multiple passes over note content (10+ services)
   - Heavy operations:
     - Dataview block processing (async but CPU-heavy)
     - Wikilink resolution (regex + mapping)
     - Asset detection (multiple regex patterns)
     - Inline dataview rendering (regex substitution)
   - Current mitigation: Yields every 15 notes

3. **upload-notes (Step 7)**:
   - Batching and serialization of DTOs
   - JSON.stringify on large payloads
   - HTTP round-trips (I/O, should not block if properly async)

4. **upload-assets (Step 8)**:
   - Binary file reads via Vault API
   - Base64 encoding (CPU-intensive for large images)
   - HTTP round-trips

### Validation Required

- [ ] Run publishing on ~368-note test vault
- [ ] Capture logs with `enablePerformanceDebug: true`
- [ ] Extract step durations from trace summary
- [ ] Extract event loop lag statistics
- [ ] Identify which step(s) contribute most to total time
- [ ] Correlate lag spikes with specific steps

## Configuration

### Enable Performance Debugging

Add to plugin settings (`.obsidian/plugins/vps-publish/data.json`):

```json
{
  "enablePerformanceDebug": true
}
```

Or toggle in plugin settings UI (if exposed).

### Debug Mode (Existing)

Set `logLevel: "debug"` for detailed console logs:

```json
{
  "logLevel": "debug"
}
```

Combination of both provides maximum diagnostics.

## Usage

### Interpreting Logs

#### Trace Summary

```
═══════════════════════════════════════════════════
📊 PUBLISHING TRACE SUMMARY
Upload Run ID: 123e4567-e89b-12d3-a456-426614174000
═══════════════════════════════════════════════════
  5-parse-content                4.23s
  2-collect-notes                2.15s
  7-upload-notes                 1.87s
  8-upload-assets                0.95s
  6-session-start                0.42s
  ...
───────────────────────────────────────────────────
  TOTAL                          9.62s
═══════════════════════════════════════════════════
```

**Interpretation**: Steps are sorted by duration (slowest first). Identify the top 1-3 consumers.

#### Event Loop Lag Statistics

```
⏱️ Event Loop Lag Statistics {
  uploadRunId: "123e4567-e89b-12d3-a456-426614174000",
  samples: 96,
  minLagMs: "0.15",
  maxLagMs: "487.23",
  avgLagMs: "42.17",
  p50LagMs: "23.45",
  p95LagMs: "312.78",
  p99LagMs: "453.12"
}
```

**Interpretation**:

- **p95 > 200ms**: Severe UI freeze, high priority optimization target
- **p99 > 500ms**: Critical, users will perceive as completely frozen
- **Correlate with steps**: Look for lag spikes during specific trace steps

#### Performance Debug Notice

If `enablePerformanceDebug` is enabled, a Notice shows:

```
🔍 Performance Debug:
Total: 9.62s
Top steps: 5-parse-content: 4.23s, 2-collect-notes: 2.15s, 7-upload-notes: 1.87s
Event loop p95 lag: 313ms
```

This provides at-a-glance diagnostics without opening DevTools.

## Troubleshooting

### No Trace Summary in Logs

- Ensure `logLevel` is at least `"info"` (default is `"warn"`)
- Check DevTools console (`Ctrl+Shift+I` in Obsidian)
- Search for `📊 PUBLISHING TRACE SUMMARY`

### No Performance Debug Notice

- Verify `enablePerformanceDebug: true` in settings
- Ensure publishing completed successfully (not cancelled/errored)
- Check console for structured data logs

### High Lag But No Obvious Slow Step

- Lag can accumulate across many small operations
- Check p-limit concurrency settings (too high = contention)
- Verify yields are happening (search logs for checkpoint messages)

## References

### Source Files

- [event-loop-monitor.adapter.ts](c:/Users/jonathan.rouquette/_projects/obsidian-vps-publish/apps/obsidian-vps-publish/src/lib/infra/event-loop-monitor.adapter.ts) - Event loop lag monitoring
- [publishing-trace.service.ts](c:/Users/jonathan.rouquette/_projects/obsidian-vps-publish/apps/obsidian-vps-publish/src/lib/infra/publishing-trace.service.ts) - Step timing and trace correlation
- [main.ts:publishToSiteAsync](c:/Users/jonathan.rouquette/_projects/obsidian-vps-publish/apps/obsidian-vps-publish/src/main.ts#L343) - Main publishing workflow
- [parse-content.handler.ts](c:/Users/jonathan.rouquette/_projects/obsidian-vps-publish/libs/core-application/src/lib/vault-parsing/handler/parse-content.handler.ts) - Content parsing pipeline

### Related Documentation

- [Plugin Architecture](../plugin/README.md)
- [Performance Testing](../api/performance-testing.md) (backend load testing)

---

**Last Updated**: 2025-12-27  
**Status**: Instrumentation complete, awaiting real vault measurements
