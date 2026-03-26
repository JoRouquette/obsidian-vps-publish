import { describe, expect, it } from '@jest/globals';

import {
  buildRevisionComparison,
  loadBenchmarkFixtures,
  renderBenchmarkMarkdown,
  renderRevisionComparisonMarkdown,
  runPublicationBenchmarkReport,
} from '../publication-trace-benchmark.runner';

describe('publication trace benchmark harness', () => {
  it('loads the benchmark fixture corpus from disk', async () => {
    const fixtures = await loadBenchmarkFixtures();

    expect(fixtures.map((fixture) => fixture.id)).toEqual([
      'basic-linked-notes',
      'duplicate-route-corpus',
    ]);
    expect(fixtures[0]?.existingPublication?.pipelineState).toBe('unchanged');
    expect(fixtures[1]?.existingPublication?.pipelineState).toBe('changed');
  });

  it('produces comparable reports for plugin-owned and api-owned deterministic transform modes', async () => {
    const [fixture] = await loadBenchmarkFixtures(['basic-linked-notes']);
    const report = await runPublicationBenchmarkReport({
      fixtures: [fixture],
      mode: 'both',
      iterations: 1,
    });

    expect(report.aggregates).toHaveLength(2);
    expect(report.comparisons).toHaveLength(1);

    const pluginOwned = report.aggregates.find((aggregate) => aggregate.mode === 'plugin-owned');
    const apiOwned = report.aggregates.find((aggregate) => aggregate.mode === 'api-owned');

    expect(pluginOwned).toBeDefined();
    expect(apiOwned).toBeDefined();
    expect(pluginOwned?.samples[0].uploadRunId).toBeTruthy();
    expect(pluginOwned?.samples[0].sessionId).toBeTruthy();
    expect(pluginOwned?.samples[0].jobId).toBeTruthy();
    expect(pluginOwned?.samples[0].timings.time_to_first_request_ms).toBeGreaterThanOrEqual(0);
    expect(pluginOwned?.samples[0].payloadSizes.notes_chunk_count).toBeGreaterThanOrEqual(1);
    expect(pluginOwned?.samples[0].uploadedNoteCount).toBe(2);
    expect(pluginOwned?.samples[0].skippedNoteCount).toBe(1);
    expect(pluginOwned?.samples[0].deduplication.pipelineChanged).toBe(false);
    expect(pluginOwned?.samples[0].deduplication.noteHashFilterApplied).toBe(true);
    expect(pluginOwned?.samples[0].deduplication.skipStrategy).toBe('source-hash-by-route');
    expect(pluginOwned?.average.uploaded_note_count).toBe(2);
    expect(pluginOwned?.average.skipped_note_count).toBe(1);
    expect(apiOwned?.samples[0].finalization.status).toBe('completed');
    expect(apiOwned?.samples[0].finalization.total_phase_duration_ms).toBeGreaterThanOrEqual(0);
    expect(apiOwned?.samples[0].uploadedNoteCount).toBe(2);
    expect(apiOwned?.samples[0].skippedNoteCount).toBe(1);
    expect(apiOwned?.samples[0].deduplication.pipelineChanged).toBe(false);
    expect(apiOwned?.samples[0].deduplication.noteHashFilterApplied).toBe(true);
    expect(apiOwned?.samples[0].deduplication.skipStrategy).toBe('source-hash-by-vault-path');
    expect(apiOwned?.average.uploaded_note_count).toBe(2);
    expect(apiOwned?.average.skipped_note_count).toBe(1);

    const comparison = report.comparisons[0];
    expect(comparison.fixtureId).toBe('basic-linked-notes');
    expect(comparison.deltas).toBeDefined();

    const markdown = renderBenchmarkMarkdown(report);
    expect(markdown).toContain('# Publication Trace Benchmark');
    expect(markdown).toContain('basic-linked-notes');
    expect(markdown).toContain('Skipped');
  });

  it('models pipeline-changed scenarios by keeping note-hash skipping disabled', async () => {
    const [fixture] = await loadBenchmarkFixtures(['duplicate-route-corpus']);
    const report = await runPublicationBenchmarkReport({
      fixtures: [fixture],
      mode: 'both',
      iterations: 1,
    });

    expect(report.aggregates).toHaveLength(2);
    for (const aggregate of report.aggregates) {
      const sample = aggregate.samples[0];
      expect(sample.deduplication.pipelineChanged).toBe(true);
      expect(sample.deduplication.noteHashFilterApplied).toBe(false);
      expect(sample.deduplication.skipStrategy).toBe('none');
      expect(sample.skippedNoteCount).toBe(0);
      expect(sample.uploadedNoteCount).toBe(sample.publishableNoteCount);
      expect(sample.timings.note_hash_filter_duration_ms).toBeGreaterThanOrEqual(0);
    }
  });

  it('renders machine-readable revision comparisons from saved reports', async () => {
    const [fixture] = await loadBenchmarkFixtures(['duplicate-route-corpus']);
    const baseline = await runPublicationBenchmarkReport({
      fixtures: [fixture],
      mode: 'plugin-owned',
      iterations: 1,
    });
    const candidate = await runPublicationBenchmarkReport({
      fixtures: [fixture],
      mode: 'plugin-owned',
      iterations: 1,
    });

    const comparison = buildRevisionComparison({ baseline, candidate });

    expect(comparison.baselineRevision).toBeTruthy();
    expect(comparison.candidateRevision).toBeTruthy();
    expect(comparison.comparisons).toHaveLength(1);
    expect(
      comparison.comparisons.every(
        (entry) => entry.fixtureId === 'duplicate-route-corpus' && !!entry.mode
      )
    ).toBe(true);

    const markdown = renderRevisionComparisonMarkdown(comparison);
    expect(markdown).toContain('# Publication Trace Benchmark Comparison');
    expect(markdown).toContain('duplicate-route-corpus');
  });
});
