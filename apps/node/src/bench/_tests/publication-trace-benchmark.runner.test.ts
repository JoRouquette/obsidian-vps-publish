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

  it('produces comparable reports for pipeline-unchanged and pipeline-changed scenarios', async () => {
    const [fixture] = await loadBenchmarkFixtures(['basic-linked-notes']);
    const report = await runPublicationBenchmarkReport({
      fixtures: [fixture],
      mode: 'both',
      iterations: 1,
    });

    expect(report.aggregates).toHaveLength(2);
    expect(report.comparisons).toHaveLength(1);

    const unchanged = report.aggregates.find(
      (aggregate) => aggregate.mode === 'pipeline-unchanged'
    );
    const changed = report.aggregates.find((aggregate) => aggregate.mode === 'pipeline-changed');

    expect(unchanged).toBeDefined();
    expect(changed).toBeDefined();
    expect(unchanged?.samples[0].uploadRunId).toBeTruthy();
    expect(unchanged?.samples[0].sessionId).toBeTruthy();
    expect(unchanged?.samples[0].jobId).toBeTruthy();
    expect(unchanged?.samples[0].timings.time_to_first_request_ms).toBeGreaterThanOrEqual(0);
    expect(unchanged?.samples[0].payloadSizes.notes_chunk_count).toBeGreaterThanOrEqual(1);
    expect(unchanged?.samples[0].uploadedNoteCount).toBe(2);
    expect(unchanged?.samples[0].skippedNoteCount).toBe(1);
    expect(unchanged?.samples[0].deduplication.pipelineChanged).toBe(false);
    expect(unchanged?.samples[0].deduplication.noteHashFilterApplied).toBe(true);
    expect(unchanged?.samples[0].deduplication.skipStrategy).toBe('source-hash-by-vault-path');
    expect(unchanged?.average.uploaded_note_count).toBe(2);
    expect(unchanged?.average.skipped_note_count).toBe(1);
    expect(changed?.samples[0].finalization.status).toBe('completed');
    expect(changed?.samples[0].finalization.total_phase_duration_ms).toBeGreaterThanOrEqual(0);
    expect(changed?.samples[0].deduplication.pipelineChanged).toBe(true);
    expect(changed?.samples[0].deduplication.noteHashFilterApplied).toBe(false);
    expect(changed?.samples[0].deduplication.skipStrategy).toBe('none');
    expect(changed?.average.uploaded_note_count).toBe(changed?.samples[0].publishableNoteCount);
    expect(changed?.average.skipped_note_count).toBe(0);

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
    const unchanged = report.aggregates.find(
      (aggregate) => aggregate.mode === 'pipeline-unchanged'
    );
    const changed = report.aggregates.find((aggregate) => aggregate.mode === 'pipeline-changed');

    expect(unchanged).toBeDefined();
    expect(changed).toBeDefined();
    expect(unchanged?.samples[0].deduplication.pipelineChanged).toBe(false);
    expect(unchanged?.samples[0].deduplication.noteHashFilterApplied).toBe(true);
    expect(unchanged?.samples[0].deduplication.skipStrategy).toBe('source-hash-by-vault-path');
    expect(unchanged?.samples[0].skippedNoteCount).toBeGreaterThan(0);
    expect(changed?.samples[0].deduplication.pipelineChanged).toBe(true);
    expect(changed?.samples[0].deduplication.noteHashFilterApplied).toBe(false);
    expect(changed?.samples[0].deduplication.skipStrategy).toBe('none');
    expect(changed?.samples[0].skippedNoteCount).toBe(0);
    expect(changed?.samples[0].uploadedNoteCount).toBe(changed?.samples[0].publishableNoteCount);
    expect(changed?.samples[0].timings.note_hash_filter_duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('renders machine-readable revision comparisons from saved reports', async () => {
    const [fixture] = await loadBenchmarkFixtures(['duplicate-route-corpus']);
    const baseline = await runPublicationBenchmarkReport({
      fixtures: [fixture],
      mode: 'pipeline-unchanged',
      iterations: 1,
    });
    const candidate = await runPublicationBenchmarkReport({
      fixtures: [fixture],
      mode: 'pipeline-unchanged',
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
