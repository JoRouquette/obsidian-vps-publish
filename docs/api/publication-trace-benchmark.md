# Publication Trace Benchmark

This harness turns the publication hot-path and finalization instrumentation into reproducible benchmark traces.

It is intended for before/after comparisons across revisions, not for CI timing assertions.

## What It Measures

Each run captures:

- `uploadRunId`
- `sessionId`
- `jobId`
- pipeline state scenario: `pipeline-unchanged` or `pipeline-changed`
- note count and asset count
- uploaded note count and skipped note count after simulated unchanged-note filtering
- request payload sizes and estimated chunk counts
- `time_to_first_request_ms`
- plugin-side hot-path timings mirrored by the benchmark harness
- `/notes/upload` and `/assets/upload` handler durations
- total publication duration
- backend finalization phase timings

## Fixture Corpus

Fixtures live under [apps/node/src/assets/publication-trace-bench/fixtures](/C:/Users/jonathan.rouquette/_projects/obsidian-vps-publish/apps/node/src/assets/publication-trace-bench/fixtures).

Current samples:

- `basic-linked-notes`
- `duplicate-route-corpus`

Fixtures can also seed an `existingPublication` scenario to model the live dedup handshake:

- `pipelineState: "unchanged"` simulates a matching production manifest and enables note-hash filtering
- `pipelineState: "changed"` simulates a pipeline-signature mismatch and forces full note upload
- `unchangedNoteIds` marks notes whose stored `sourceHash` should match the current source
- `missingHashNoteIds` omits stored hashes to simulate safe fallback uploads

## Run A Benchmark

Build the node app first:

```powershell
npm run bench:publication-trace:build
```

Run both pipeline-state scenarios against all fixtures:

```powershell
node tools/publication-trace-benchmark.cjs run --fixture all --mode both --iterations 3 --output-dir tmp/publication-trace/current
```

Run a single fixture:

```powershell
node tools/publication-trace-benchmark.cjs run --fixture basic-linked-notes --mode both --iterations 5 --output-dir tmp/publication-trace/basic
```

## Compare Two Revisions

1. Check out the baseline revision.
2. Build and run the benchmark, for example:

```powershell
npm run bench:publication-trace:build
node tools/publication-trace-benchmark.cjs run --fixture all --mode both --iterations 3 --output-dir tmp/publication-trace/baseline
```

3. Check out the candidate revision.
4. Build and run the benchmark again:

```powershell
npm run bench:publication-trace:build
node tools/publication-trace-benchmark.cjs run --fixture all --mode both --iterations 3 --output-dir tmp/publication-trace/candidate
```

5. Compare the two JSON reports:

```powershell
node tools/publication-trace-benchmark.cjs compare --baseline tmp/publication-trace/baseline/publication-trace-report.json --candidate tmp/publication-trace/candidate/publication-trace-report.json --output-dir tmp/publication-trace/comparison
```

## Outputs

Each `run` command writes:

- `publication-trace-report.json`
- `publication-trace-report.md`

Each `compare` command writes:

- `publication-trace-comparison.json`
- `publication-trace-comparison.md`

The JSON output is the source of truth for machine-readable analysis. The Markdown output is a quick human summary.

## Notes

- The harness is fixture-driven and does not enforce timing budgets.
- It reuses the existing instrumentation concepts and backend finalization phases without changing publication semantics.
- The live architecture is now always API-owned for deterministic transforms. The harness compares two meaningful current scenarios:
  - `pipeline-unchanged` reuses stored `vaultPath -> sourceHash` values and models safe unchanged-note skipping
  - `pipeline-changed` simulates a pipeline-signature mismatch and forces full note upload
  - notes without stored authoritative hashes are uploaded in both scenarios
- The harness still does not run the real Obsidian desktop UI thread or full HTTP transport stack, so it is best for relative revision comparisons rather than absolute user-perceived latency claims.
- Run it from the repository root so fixture and asset paths resolve consistently.
