import { execSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import {
  CreateSessionHandler,
  FinishSessionHandler,
  NotesMapper,
  ParseContentHandler,
  UploadAssetsHandler,
  UploadNotesHandler,
} from '@core-application';
import { EvaluateIgnoreRulesHandler } from '@core-application/vault-parsing/handler/evaluate-ignore-rules.handler';
import { ComputeRoutingService } from '@core-application/vault-parsing/services/compute-routing.service';
import { DeduplicateNotesService } from '@core-application/vault-parsing/services/deduplicate-notes.service';
import { DetectAssetsService } from '@core-application/vault-parsing/services/detect-assets.service';
import { DetectLeafletBlocksService } from '@core-application/vault-parsing/services/detect-leaflet-blocks.service';
import { DetectWikilinksService } from '@core-application/vault-parsing/services/detect-wikilinks.service';
import { EnsureTitleHeaderService } from '@core-application/vault-parsing/services/ensure-title-header.service';
import { NormalizeFrontmatterService } from '@core-application/vault-parsing/services/normalize-frontmatter.service';
import { RemoveNoPublishingMarkerService } from '@core-application/vault-parsing/services/remove-no-publishing-marker.service';
import { RenderInlineDataviewService } from '@core-application/vault-parsing/services/render-inline-dataview.service';
import { ResolveWikilinksService } from '@core-application/vault-parsing/services/resolve-wikilinks.service';
import type {
  CollectedNote,
  DomainFrontmatter,
  IgnoreRule,
  LoggerPort,
  Manifest,
  PublishableNote,
  ResolvedAssetFile,
  SanitizationRules,
} from '@core-domain';
import { LogLevel, Slug } from '@core-domain';
import { z } from 'zod';

import { AssetsFileSystemStorage } from '../infra/filesystem/assets-file-system.storage';
import { FileSystemSessionRepository } from '../infra/filesystem/file-system-session.repository';
import { ManifestFileSystem } from '../infra/filesystem/manifest-file-system';
import { NotesFileSystemStorage } from '../infra/filesystem/notes-file-system.storage';
import { SessionNotesFileStorage } from '../infra/filesystem/session-notes-file.storage';
import { StagingManager } from '../infra/filesystem/staging-manager';
import { UuidIdGenerator } from '../infra/id/uuid-id.generator';
import { CalloutRendererService } from '../infra/markdown/callout-renderer.service';
import { MarkdownItRenderer } from '../infra/markdown/markdown-it.renderer';
import { SessionFinalizationJobService } from '../infra/sessions/session-finalization-job.service';
import { SessionFinalizerService } from '../infra/sessions/session-finalizer.service';
import { AssetHashService } from '../infra/utils/asset-hash.service';
import {
  type PreparedPublicationFixture,
  type PublicationBenchmarkAggregate,
  type PublicationBenchmarkCompareReport,
  type PublicationBenchmarkFixture,
  type PublicationBenchmarkMetricSummary,
  type PublicationBenchmarkMode,
  type PublicationBenchmarkModeComparison,
  type PublicationBenchmarkReport,
  type PublicationBenchmarkRevisionComparison,
  type PublicationBenchmarkRun,
} from './publication-trace-benchmark.types';

const FIXTURE_SCHEMA = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1),
  deduplicationEnabled: z.boolean().optional(),
  calloutStylePaths: z.array(z.string()).optional(),
  ignoredTags: z.array(z.string()).optional(),
  ignoreRules: z
    .array(
      z.object({
        property: z.string(),
        ignoreIf: z.any().optional(),
        equals: z.any().optional(),
        includes: z.any().optional(),
      })
    )
    .optional(),
  cleanupRules: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        regex: z.string(),
        replacement: z.string(),
        isEnabled: z.boolean(),
      })
    )
    .optional(),
  existingPublication: z
    .object({
      pipelineState: z.enum(['unchanged', 'changed']).optional(),
      unchangedNoteIds: z.array(z.string()).optional(),
      missingHashNoteIds: z.array(z.string()).optional(),
    })
    .optional(),
  notes: z.array(
    z.object({
      noteId: z.string(),
      title: z.string(),
      vaultPath: z.string(),
      relativePath: z.string(),
      content: z.string(),
      frontmatter: z.record(z.string(), z.unknown()).optional(),
      folderConfig: z.object({
        id: z.string(),
        vaultFolder: z.string(),
        routeBase: z.string(),
        vpsId: z.string(),
        ignoredCleanupRuleIds: z.array(z.string()).optional(),
        displayName: z.string().optional(),
        customIndexFile: z.string().optional(),
      }),
    })
  ),
  assets: z
    .array(
      z.object({
        relativeAssetPath: z.string(),
        vaultPath: z.string(),
        fileName: z.string(),
        mimeType: z.string().optional(),
        contentBase64: z.string(),
      })
    )
    .optional(),
});

const DEFAULT_MAX_REQUEST_BYTES = 1024 * 1024;

type BenchmarkEnvironment = {
  tempDir: string;
  createSessionHandler: CreateSessionHandler;
  uploadNotesHandler: UploadNotesHandler;
  uploadAssetsHandler: UploadAssetsHandler;
  finishSessionHandler: FinishSessionHandler;
  finalizationJobService: SessionFinalizationJobService;
  manifestStorage: ManifestFileSystem;
  cleanup: () => Promise<void>;
};

type SimulatedNoteHashFilterResult = {
  notesToUpload: PublishableNote[];
  skippedCount: number;
  applied: boolean;
  pipelineChanged: boolean;
  strategy: 'none' | 'source-hash-by-route' | 'source-hash-by-vault-path';
};

type ApiAssetPayload = {
  relativePath: string;
  vaultPath: string;
  fileName: string;
  mimeType: string;
  contentBase64: string;
};

class NullLogger implements LoggerPort {
  level = LogLevel.info;

  child(): LoggerPort {
    return this;
  }
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

export async function loadBenchmarkFixtures(
  fixtureIds?: string[]
): Promise<PublicationBenchmarkFixture[]> {
  const fixturesDir = resolveFixturesDir();
  const entries = await fs.readdir(fixturesDir, { withFileTypes: true });
  const targetIds = fixtureIds && fixtureIds.length > 0 ? new Set(fixtureIds) : null;
  const fixtures: PublicationBenchmarkFixture[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }

    const raw = JSON.parse(await fs.readFile(path.join(fixturesDir, entry.name), 'utf8'));
    const fixture = FIXTURE_SCHEMA.parse(raw) as PublicationBenchmarkFixture;
    if (targetIds && !targetIds.has(fixture.id)) {
      continue;
    }
    fixtures.push(fixture);
  }

  fixtures.sort((left, right) => left.id.localeCompare(right.id));
  return fixtures;
}

export async function runPublicationBenchmarkReport(args: {
  fixtures: PublicationBenchmarkFixture[];
  mode: 'plugin-owned' | 'api-owned' | 'both';
  iterations: number;
}): Promise<PublicationBenchmarkReport> {
  const runs: PublicationBenchmarkRun[] = [];
  const modes = args.mode === 'both' ? (['plugin-owned', 'api-owned'] as const) : [args.mode];

  for (const fixture of args.fixtures) {
    for (const mode of modes) {
      for (let iteration = 0; iteration < args.iterations; iteration++) {
        runs.push(await runPublicationBenchmarkIteration(fixture, mode));
      }
    }
  }

  const aggregates = aggregateBenchmarkRuns(runs, args.iterations);

  return {
    generatedAt: new Date().toISOString(),
    gitRevision: detectGitRevision(),
    nodeVersion: process.version,
    platform: `${process.platform}-${process.arch}`,
    iterations: args.iterations,
    fixtureIds: args.fixtures.map((fixture) => fixture.id),
    mode: args.mode,
    aggregates,
    comparisons: buildModeComparisons(aggregates),
  };
}

export async function runPublicationBenchmarkIteration(
  fixture: PublicationBenchmarkFixture,
  mode: PublicationBenchmarkMode
): Promise<PublicationBenchmarkRun> {
  const logger = new NullLogger();
  const deduplicationEnabled = fixture.deduplicationEnabled !== false;
  const apiOwnedDeterministicNoteTransformsEnabled = mode === 'api-owned';
  const uploadRunId = randomUUID();
  const publicationStartEpochMs = Date.now();
  const publicationStart = performance.now();
  const env = await createBenchmarkEnvironment(logger);

  try {
    const { calloutStyles, durationMs: calloutStyleLoadingDurationMs } = await loadCalloutStyles(
      fixture.calloutStylePaths ?? []
    );
    const pipelineSignature = computePipelineSignature(fixture.version, {
      calloutStyles,
      cleanupRules: (fixture.cleanupRules ?? []).filter((rule) => rule.isEnabled),
      ignoredTags: fixture.ignoredTags ?? [],
    });

    const parseStart = performance.now();
    const prepared = await preparePublicationFixture(fixture, mode, logger);
    const parseAndTransformDurationMs = performance.now() - parseStart;

    const dedupStart = performance.now();
    const publishables =
      deduplicationEnabled && !apiOwnedDeterministicNoteTransformsEnabled
        ? new DeduplicateNotesService(logger).process(prepared.notes)
        : prepared.notes;
    const dedupDurationMs = performance.now() - dedupStart;

    await seedExistingPublicationManifest({
      env,
      fixture,
      publishables,
      pipelineSignature,
    });

    const timeToFirstRequestMs = performance.now() - publicationStart;
    const startSessionStart = performance.now();
    const startResult = await env.createSessionHandler.handle({
      notesPlanned: publishables.length,
      assetsPlanned: prepared.assets.length,
      batchConfig: {
        maxBytesPerRequest: DEFAULT_MAX_REQUEST_BYTES,
      },
      ignoreRules: (fixture.ignoreRules ?? []) as IgnoreRule[],
      ignoredTags: fixture.ignoredTags ?? [],
      folderDisplayNames: collectFolderDisplayNames(publishables),
      pipelineSignature,
      deduplicationEnabled,
      apiOwnedDeterministicNoteTransformsEnabled,
    });
    const startSessionDurationMs = performance.now() - startSessionStart;

    const noteHashFilterStart = performance.now();
    const noteHashFilter = simulateNoteHashFilter({
      notes: publishables,
      existingNoteHashes: startResult.existingNoteHashes,
      existingSourceNoteHashesByVaultPath: startResult.existingSourceNoteHashesByVaultPath,
      pipelineChanged: startResult.pipelineChanged === true,
      apiOwnedDeterministicNoteTransformsEnabled,
    });
    const noteHashFilterDurationMs = performance.now() - noteHashFilterStart;
    const notesToUpload = noteHashFilter.notesToUpload;

    const notesBatchInfoStart = performance.now();
    const noteBatches = batchItemsByWrappedJsonBytes(
      notesToUpload,
      DEFAULT_MAX_REQUEST_BYTES,
      (batch) => ({
        notes: batch,
      })
    );
    const notesBatchInfoDurationMs = performance.now() - notesBatchInfoStart;

    const noteChunkStart = performance.now();
    const notesChunkMetadata = await prepareChunkMetadata(
      noteBatches.map((batch, index) => ({
        uploadId: `notes-${startResult.sessionId}-${index + 1}`,
        payload: {
          notes: batch,
          ...(index === 0 && fixture.cleanupRules && fixture.cleanupRules.length > 0
            ? { cleanupRules: fixture.cleanupRules }
            : {}),
        },
      }))
    );
    const notesChunkPrepareDurationMs = performance.now() - noteChunkStart;

    const notesUploadStart = performance.now();
    for (let index = 0; index < noteBatches.length; index++) {
      await env.uploadNotesHandler.handle({
        sessionId: startResult.sessionId,
        notes: noteBatches[index],
        cleanupRules: index === 0 ? ((fixture.cleanupRules as SanitizationRules[]) ?? []) : [],
        apiOwnedDeterministicNoteTransformsEnabled,
      });
    }
    const notesUploadDurationMs = performance.now() - notesUploadStart;

    const assetPrepStart = performance.now();
    const apiAssets = await Promise.all(
      prepared.assets.map((asset) => buildApiAssetPayload(asset))
    );
    const assetUploadPrepDurationMs = performance.now() - assetPrepStart;

    const assetBatchInfoStart = performance.now();
    const assetBatches = batchItemsByWrappedJsonBytes(
      apiAssets,
      DEFAULT_MAX_REQUEST_BYTES,
      (batch) => ({
        assets: batch,
      })
    );
    const assetBatchInfoDurationMs = performance.now() - assetBatchInfoStart;

    const assetChunkStart = performance.now();
    const assetsChunkMetadata = await prepareChunkMetadata(
      assetBatches.map((batch, index) => ({
        uploadId: `assets-${startResult.sessionId}-${index + 1}`,
        payload: {
          assets: batch,
        },
      }))
    );
    const assetsChunkPrepareDurationMs = performance.now() - assetChunkStart;

    const assetsUploadStart = performance.now();
    if (apiAssets.length > 0) {
      await env.uploadAssetsHandler.handle({
        sessionId: startResult.sessionId,
        assets: apiAssets,
        deduplicationEnabled,
      });
    }
    const assetsUploadDurationMs = performance.now() - assetsUploadStart;

    const allCollectedRoutes = apiOwnedDeterministicNoteTransformsEnabled
      ? undefined
      : prepared.notes.map((note) => note.routing.fullPath);

    const finishStart = performance.now();
    await env.finishSessionHandler.handle({
      sessionId: startResult.sessionId,
      notesProcessed: notesToUpload.length,
      assetsProcessed: apiAssets.length,
      allCollectedRoutes,
    });
    const finishSessionDurationMs = performance.now() - finishStart;

    const jobId = await env.finalizationJobService.queueFinalization(startResult.sessionId);
    const completedJob = await env.finalizationJobService.waitForJob(jobId, 120000);
    const totalPublicationDurationMs = performance.now() - publicationStart;
    const phaseTimings =
      completedJob.result?.finalizationTimings ?? completedJob.phaseTimings ?? {};

    return {
      fixtureId: fixture.id,
      fixtureVersion: fixture.version,
      fixtureDescription: fixture.description,
      mode,
      uploadRunId,
      sessionId: startResult.sessionId,
      jobId,
      contentRevision: completedJob.result?.contentRevision,
      noteCount: fixture.notes.length,
      assetCount: prepared.assets.length,
      publishableNoteCount: publishables.length,
      uploadedNoteCount: notesToUpload.length,
      skippedNoteCount: noteHashFilter.skippedCount,
      uploadedAssetCount: apiAssets.length,
      deduplicationEnabled,
      apiOwnedDeterministicNoteTransformsEnabled,
      deduplication: {
        pipelineChanged: noteHashFilter.pipelineChanged,
        noteHashFilterApplied: noteHashFilter.applied,
        skipStrategy: noteHashFilter.strategy,
      },
      timings: {
        publication_start_epoch_ms: publicationStartEpochMs,
        time_to_first_request_ms: timeToFirstRequestMs,
        start_session_duration_ms: startSessionDurationMs,
        parse_and_transform_duration_ms: parseAndTransformDurationMs,
        dedup_duration_ms: dedupDurationMs,
        callout_style_loading_duration_ms: calloutStyleLoadingDurationMs,
        note_hash_filter_duration_ms: noteHashFilterDurationMs,
        notes_batch_info_duration_ms: notesBatchInfoDurationMs,
        asset_batch_info_duration_ms: assetBatchInfoDurationMs,
        asset_upload_prep_duration_ms: assetUploadPrepDurationMs,
        notes_upload_duration_ms: notesUploadDurationMs,
        assets_upload_duration_ms: assetsUploadDurationMs,
        finish_session_duration_ms: finishSessionDurationMs,
        total_publication_duration_ms: totalPublicationDurationMs,
        chunk_prepare_duration_ms: notesChunkPrepareDurationMs + assetsChunkPrepareDurationMs,
      },
      payloadSizes: {
        notes_upload_json_bytes: byteSize(
          JSON.stringify({
            notes: notesToUpload,
            cleanupRules: fixture.cleanupRules ?? [],
          })
        ),
        assets_upload_json_bytes: byteSize(JSON.stringify({ assets: apiAssets })),
        notes_chunk_count: notesChunkMetadata.chunkCount,
        assets_chunk_count: assetsChunkMetadata.chunkCount,
        notes_chunk_request_bytes: notesChunkMetadata.totalRequestBytes,
        assets_chunk_request_bytes: assetsChunkMetadata.totalRequestBytes,
      },
      finalization: {
        status: 'completed',
        phaseTimings,
        total_phase_duration_ms: sumObjectValues(phaseTimings),
      },
    };
  } finally {
    await env.cleanup();
  }
}

export function aggregateBenchmarkRuns(
  runs: PublicationBenchmarkRun[],
  iterations: number
): PublicationBenchmarkAggregate[] {
  const grouped = new Map<string, PublicationBenchmarkRun[]>();
  for (const run of runs) {
    const key = `${run.fixtureId}::${run.mode}`;
    const list = grouped.get(key) ?? [];
    list.push(run);
    grouped.set(key, list);
  }

  return [...grouped.entries()]
    .map(([key, samples]) => {
      const [fixtureId, mode] = key.split('::') as [string, PublicationBenchmarkMode];
      return {
        fixtureId,
        mode,
        iterations,
        noteCount: samples[0].noteCount,
        assetCount: samples[0].assetCount,
        average: summarizeMetrics(samples, averageReducer),
        min: summarizeMetrics(samples, minReducer),
        max: summarizeMetrics(samples, maxReducer),
        samples,
      } satisfies PublicationBenchmarkAggregate;
    })
    .sort((left, right) =>
      left.fixtureId === right.fixtureId
        ? left.mode.localeCompare(right.mode)
        : left.fixtureId.localeCompare(right.fixtureId)
    );
}

export function buildModeComparisons(
  aggregates: PublicationBenchmarkAggregate[]
): PublicationBenchmarkModeComparison[] {
  const byFixture = new Map<string, PublicationBenchmarkModeComparison>();
  for (const aggregate of aggregates) {
    const comparison = byFixture.get(aggregate.fixtureId) ?? { fixtureId: aggregate.fixtureId };
    if (aggregate.mode === 'plugin-owned') {
      comparison.pluginOwned = aggregate;
    } else {
      comparison.apiOwned = aggregate;
    }
    byFixture.set(aggregate.fixtureId, comparison);
  }

  for (const comparison of byFixture.values()) {
    if (comparison.pluginOwned && comparison.apiOwned) {
      comparison.deltas = calculateMetricDeltas(
        comparison.pluginOwned.average,
        comparison.apiOwned.average
      );
    }
  }

  return [...byFixture.values()].sort((left, right) =>
    left.fixtureId.localeCompare(right.fixtureId)
  );
}

export function buildRevisionComparison(args: {
  baseline: PublicationBenchmarkReport;
  candidate: PublicationBenchmarkReport;
}): PublicationBenchmarkCompareReport {
  const baselineMap = new Map(
    args.baseline.aggregates.map((aggregate) => [
      `${aggregate.fixtureId}::${aggregate.mode}`,
      aggregate,
    ])
  );
  const candidateMap = new Map(
    args.candidate.aggregates.map((aggregate) => [
      `${aggregate.fixtureId}::${aggregate.mode}`,
      aggregate,
    ])
  );
  const keys = new Set([...baselineMap.keys(), ...candidateMap.keys()]);

  const comparisons = [...keys]
    .map((key) => {
      const [fixtureId, mode] = key.split('::') as [string, PublicationBenchmarkMode];
      const baseline = baselineMap.get(key);
      const candidate = candidateMap.get(key);
      return {
        fixtureId,
        mode,
        baseline,
        candidate,
        deltas:
          baseline && candidate
            ? calculateMetricDeltas(baseline.average, candidate.average)
            : undefined,
      } satisfies PublicationBenchmarkRevisionComparison;
    })
    .sort((left, right) =>
      left.fixtureId === right.fixtureId
        ? left.mode.localeCompare(right.mode)
        : left.fixtureId.localeCompare(right.fixtureId)
    );

  return {
    generatedAt: new Date().toISOString(),
    baselineRevision: args.baseline.gitRevision,
    candidateRevision: args.candidate.gitRevision,
    fixtureIds: [...new Set(comparisons.map((comparison) => comparison.fixtureId))].sort(),
    comparisons,
  };
}

export function renderBenchmarkMarkdown(report: PublicationBenchmarkReport): string {
  const lines: string[] = [
    '# Publication Trace Benchmark',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Revision: ${report.gitRevision}`,
    `- Iterations: ${report.iterations}`,
    `- Mode: ${report.mode}`,
    '',
    '## Aggregates',
    '',
    '| Fixture | Mode | Notes | Uploaded | Skipped | Assets | TTFR ms | Note-hash filter ms | Notes upload ms | Total ms | Finalization ms |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const aggregate of report.aggregates) {
    lines.push(
      `| ${aggregate.fixtureId} | ${aggregate.mode} | ${aggregate.noteCount} | ${aggregate.average.uploaded_note_count.toFixed(2)} | ${aggregate.average.skipped_note_count.toFixed(2)} | ${aggregate.assetCount} | ${aggregate.average.time_to_first_request_ms.toFixed(2)} | ${aggregate.average.note_hash_filter_duration_ms.toFixed(2)} | ${aggregate.average.notes_upload_duration_ms.toFixed(2)} | ${aggregate.average.total_publication_duration_ms.toFixed(2)} | ${aggregate.samples[0].finalization.total_phase_duration_ms.toFixed(2)} |`
    );
  }

  if (report.comparisons.some((comparison) => comparison.deltas)) {
    lines.push('', '## Mode Comparisons', '');
    lines.push(
      '| Fixture | Delta Uploaded notes | Delta Skipped notes | Delta TTFR ms | Delta Note-hash filter ms | Delta Notes upload ms | Delta Total ms | Delta Finalization ms |'
    );
    lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
    for (const comparison of report.comparisons) {
      if (!comparison.deltas) {
        continue;
      }
      const pluginFinalization =
        comparison.pluginOwned?.samples[0].finalization.total_phase_duration_ms ?? 0;
      const apiFinalization =
        comparison.apiOwned?.samples[0].finalization.total_phase_duration_ms ?? 0;
      lines.push(
        `| ${comparison.fixtureId} | ${formatDelta(comparison.deltas.uploaded_note_count)} | ${formatDelta(comparison.deltas.skipped_note_count)} | ${formatDelta(comparison.deltas.time_to_first_request_ms)} | ${formatDelta(comparison.deltas.note_hash_filter_duration_ms)} | ${formatDelta(comparison.deltas.notes_upload_duration_ms)} | ${formatDelta(comparison.deltas.total_publication_duration_ms)} | ${formatDelta(apiFinalization - pluginFinalization)} |`
      );
    }
  }

  return `${lines.join('\n')}\n`;
}

export function renderRevisionComparisonMarkdown(
  report: PublicationBenchmarkCompareReport
): string {
  const lines: string[] = [
    '# Publication Trace Benchmark Comparison',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Baseline revision: ${report.baselineRevision}`,
    `- Candidate revision: ${report.candidateRevision}`,
    '',
    '| Fixture | Mode | Delta Uploaded notes | Delta Skipped notes | Delta TTFR ms | Delta Note-hash filter ms | Delta Notes upload ms | Delta Total ms |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const comparison of report.comparisons) {
    if (!comparison.deltas) {
      continue;
    }

    lines.push(
      `| ${comparison.fixtureId} | ${comparison.mode} | ${formatDelta(comparison.deltas.uploaded_note_count)} | ${formatDelta(comparison.deltas.skipped_note_count)} | ${formatDelta(comparison.deltas.time_to_first_request_ms)} | ${formatDelta(comparison.deltas.note_hash_filter_duration_ms)} | ${formatDelta(comparison.deltas.notes_upload_duration_ms)} | ${formatDelta(comparison.deltas.total_publication_duration_ms)} |`
    );
  }

  return `${lines.join('\n')}\n`;
}

async function preparePublicationFixture(
  fixture: PublicationBenchmarkFixture,
  mode: PublicationBenchmarkMode,
  logger: LoggerPort
): Promise<PreparedPublicationFixture> {
  const parseContentHandler = new ParseContentHandler(
    new NormalizeFrontmatterService(logger),
    new EvaluateIgnoreRulesHandler((fixture.ignoreRules ?? []) as IgnoreRule[], logger),
    new NotesMapper(),
    new RenderInlineDataviewService(logger),
    new DetectLeafletBlocksService(logger),
    new EnsureTitleHeaderService(logger),
    new RemoveNoPublishingMarkerService(logger),
    new DetectAssetsService(logger),
    new ResolveWikilinksService(logger, new DetectWikilinksService(logger)),
    new ComputeRoutingService(logger),
    logger,
    undefined,
    undefined,
    undefined,
    {
      deterministicTransformsOwner: mode === 'api-owned' ? 'api' : 'plugin',
    }
  );

  const collectedNotes = fixture.notes.map((note) => ({
    ...note,
    frontmatter: toDomainFrontmatter(note.frontmatter),
  })) as CollectedNote[];

  const notes = await parseContentHandler.handle(collectedNotes);
  const assets = (fixture.assets ?? []).map(
    (asset): ResolvedAssetFile => ({
      relativeAssetPath: asset.relativeAssetPath,
      vaultPath: asset.vaultPath,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      content: Buffer.from(asset.contentBase64, 'base64'),
    })
  );

  return {
    fixture,
    notes,
    assets,
  };
}

async function seedExistingPublicationManifest(args: {
  env: BenchmarkEnvironment;
  fixture: PublicationBenchmarkFixture;
  publishables: PublishableNote[];
  pipelineSignature: { version: string; renderSettingsHash: string };
}): Promise<void> {
  const scenario = args.fixture.existingPublication;
  if (!scenario) {
    return;
  }

  const unchangedNoteIds = new Set(scenario.unchangedNoteIds ?? []);
  const missingHashNoteIds = new Set(scenario.missingHashNoteIds ?? []);
  const publishedAt = new Date('2025-01-01T00:00:00.000Z');
  const seededPipelineSignature =
    scenario.pipelineState === 'changed'
      ? {
          version: args.pipelineSignature.version,
          renderSettingsHash: `${args.pipelineSignature.renderSettingsHash}-changed`,
        }
      : args.pipelineSignature;

  const manifest: Manifest = {
    sessionId: 'bench-existing-publication',
    createdAt: publishedAt,
    lastUpdatedAt: publishedAt,
    pipelineSignature: seededPipelineSignature,
    pages: args.publishables.map((note) => ({
      id: note.noteId,
      title: note.title,
      slug: Slug.fromRoute(note.routing.fullPath || note.relativePath),
      route: note.routing.fullPath,
      publishedAt,
      vaultPath: note.vaultPath,
      relativePath: note.relativePath,
      sourceHash: missingHashNoteIds.has(note.noteId)
        ? undefined
        : unchangedNoteIds.has(note.noteId)
          ? computeSourceHash(note.content)
          : computeSourceHash(`${note.content}\n[benchmark-changed:${note.noteId}]`),
      sourceSize: byteSize(note.content),
    })),
  };

  await args.env.manifestStorage.save(manifest);
}

function simulateNoteHashFilter(args: {
  notes: PublishableNote[];
  existingNoteHashes?: Record<string, string>;
  existingSourceNoteHashesByVaultPath?: Record<string, string>;
  pipelineChanged: boolean;
  apiOwnedDeterministicNoteTransformsEnabled: boolean;
}): SimulatedNoteHashFilterResult {
  if (args.pipelineChanged) {
    return {
      notesToUpload: args.notes,
      skippedCount: 0,
      applied: false,
      pipelineChanged: true,
      strategy: 'none',
    };
  }

  const activeHashMap = args.apiOwnedDeterministicNoteTransformsEnabled
    ? (args.existingSourceNoteHashesByVaultPath ?? {})
    : (args.existingNoteHashes ?? {});

  if (Object.keys(activeHashMap).length === 0) {
    return {
      notesToUpload: args.notes,
      skippedCount: 0,
      applied: false,
      pipelineChanged: false,
      strategy: 'none',
    };
  }

  const notesToUpload: PublishableNote[] = [];
  let skippedCount = 0;

  for (const note of args.notes) {
    const dedupKey = args.apiOwnedDeterministicNoteTransformsEnabled
      ? note.vaultPath
      : note.routing.fullPath;
    const existingHash = dedupKey ? activeHashMap[dedupKey] : undefined;

    if (!existingHash) {
      notesToUpload.push(note);
      continue;
    }

    if (computeSourceHash(note.content) === existingHash) {
      skippedCount++;
      continue;
    }

    notesToUpload.push(note);
  }

  return {
    notesToUpload,
    skippedCount,
    applied: true,
    pipelineChanged: false,
    strategy: args.apiOwnedDeterministicNoteTransformsEnabled
      ? 'source-hash-by-vault-path'
      : 'source-hash-by-route',
  };
}

async function createBenchmarkEnvironment(logger: LoggerPort): Promise<BenchmarkEnvironment> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'publication-trace-bench-'));
  const contentRoot = path.join(tempDir, 'content');
  const assetsRoot = path.join(tempDir, 'assets');
  const sessionsRoot = path.join(tempDir, 'sessions');

  await fs.mkdir(contentRoot, { recursive: true });
  await fs.mkdir(assetsRoot, { recursive: true });
  await fs.mkdir(sessionsRoot, { recursive: true });

  const stagingManager = new StagingManager(contentRoot, assetsRoot, logger);
  const sessionRepository = new FileSystemSessionRepository(sessionsRoot);
  const sessionNotesStorage = new SessionNotesFileStorage(contentRoot, logger);
  const markdownRenderer = new MarkdownItRenderer(new CalloutRendererService(), logger);
  const manifestStorage = new ManifestFileSystem(contentRoot, logger);

  const createSessionHandler = new CreateSessionHandler(
    new UuidIdGenerator(),
    sessionRepository,
    manifestStorage,
    logger
  );

  const uploadNotesHandler = new UploadNotesHandler(
    markdownRenderer,
    (sessionId) => new NotesFileSystemStorage(stagingManager.contentStagingPath(sessionId), logger),
    (sessionId) => new ManifestFileSystem(stagingManager.contentStagingPath(sessionId), logger),
    logger,
    sessionNotesStorage,
    undefined,
    undefined
  );

  const uploadAssetsHandler = new UploadAssetsHandler(
    (sessionId) => new AssetsFileSystemStorage(stagingManager.assetsStagingPath(sessionId), logger),
    (sessionId) => new ManifestFileSystem(stagingManager.contentStagingPath(sessionId), logger),
    new AssetHashService(),
    undefined,
    undefined,
    undefined,
    logger
  );

  const sessionFinalizer = new SessionFinalizerService(
    sessionNotesStorage,
    stagingManager,
    markdownRenderer,
    (sessionId) => new NotesFileSystemStorage(stagingManager.contentStagingPath(sessionId), logger),
    (sessionId) => new ManifestFileSystem(stagingManager.contentStagingPath(sessionId), logger),
    sessionRepository,
    logger
  );

  return {
    tempDir,
    createSessionHandler,
    uploadNotesHandler,
    uploadAssetsHandler,
    finishSessionHandler: new FinishSessionHandler(sessionRepository),
    finalizationJobService: new SessionFinalizationJobService(
      sessionFinalizer,
      stagingManager,
      sessionRepository,
      logger,
      1
    ),
    manifestStorage,
    cleanup: async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    },
  };
}

async function loadCalloutStyles(paths: string[]): Promise<{
  calloutStyles: Record<string, string>;
  durationMs: number;
}> {
  const start = performance.now();
  const assetsRoot = resolveBenchAssetsRoot();
  const calloutStyles: Record<string, string> = {};

  for (const stylePath of paths) {
    calloutStyles[stylePath] = await fs.readFile(path.join(assetsRoot, stylePath), 'utf8');
  }

  return {
    calloutStyles,
    durationMs: performance.now() - start,
  };
}

function computePipelineSignature(
  version: string,
  renderSettings: {
    calloutStyles: Record<string, string>;
    cleanupRules: Array<{ id: string; regex: string; replacement: string; isEnabled: boolean }>;
    ignoredTags: string[];
  }
): { version: string; renderSettingsHash: string } {
  const stableObject = {
    calloutStyles: Object.fromEntries(
      Object.entries(renderSettings.calloutStyles).sort(([left], [right]) =>
        left.localeCompare(right)
      )
    ),
    cleanupRules: [...renderSettings.cleanupRules]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((rule) => ({
        id: rule.id,
        regex: rule.regex,
        replace: rule.replacement,
        isEnabled: rule.isEnabled,
      })),
    ignoredTags: [...renderSettings.ignoredTags].sort((left, right) => left.localeCompare(right)),
  };

  return {
    version,
    renderSettingsHash: createHash('sha256').update(JSON.stringify(stableObject)).digest('hex'),
  };
}

async function buildApiAssetPayload(asset: ResolvedAssetFile): Promise<ApiAssetPayload> {
  const content =
    asset.content instanceof Uint8Array ? asset.content : new Uint8Array(asset.content);
  return {
    relativePath: asset.relativeAssetPath,
    vaultPath: asset.vaultPath,
    fileName: asset.fileName,
    mimeType: asset.mimeType ?? guessMimeType(asset.fileName),
    contentBase64: Buffer.from(content).toString('base64'),
  };
}

async function prepareChunkMetadata(
  inputs: Array<{ uploadId: string; payload: unknown }>
): Promise<{ chunkCount: number; totalRequestBytes: number }> {
  let chunkCount = 0;
  let totalRequestBytes = 0;

  for (const input of inputs) {
    const jsonString = JSON.stringify(input.payload);
    const compressed = gzipSync(jsonString);
    const safeChunkSize = Math.min(
      Math.floor(DEFAULT_MAX_REQUEST_BYTES / 2),
      5 * 1024 * 1024,
      Math.max(1, compressed.length)
    );
    const totalChunks = Math.ceil(compressed.length / safeChunkSize);
    chunkCount += totalChunks;

    for (let index = 0; index < totalChunks; index++) {
      const start = index * safeChunkSize;
      const end = Math.min(start + safeChunkSize, compressed.length);
      const base64Chunk = compressed.subarray(start, end).toString('base64');
      totalRequestBytes += byteSize(
        JSON.stringify({
          metadata: {
            uploadId: input.uploadId,
            chunkIndex: index,
            totalChunks,
            originalSize: byteSize(jsonString),
            compressedSize: compressed.length,
          },
          data: base64Chunk,
        })
      );
    }
  }

  return { chunkCount, totalRequestBytes };
}

function collectFolderDisplayNames(notes: PublishableNote[]): Record<string, string> {
  return notes.reduce<Record<string, string>>((acc, note) => {
    if (note.folderConfig.routeBase && note.folderConfig.displayName) {
      acc[note.folderConfig.routeBase] = note.folderConfig.displayName;
    }
    return acc;
  }, {});
}

function batchItemsByWrappedJsonBytes<T>(
  items: T[],
  maxBytes: number,
  wrap: (batch: T[]) => unknown
): T[][] {
  if (maxBytes <= 0) {
    throw new Error('maxBytes must be > 0');
  }

  const batches: T[][] = [];
  let currentBatch: T[] = [];

  for (const item of items) {
    const candidateBatch = [...currentBatch, item];
    if (jsonByteSize(wrap(candidateBatch)) <= maxBytes || currentBatch.length === 0) {
      currentBatch = candidateBatch;
      continue;
    }

    batches.push(currentBatch);
    currentBatch = [item];
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

function toDomainFrontmatter(frontmatter?: Record<string, unknown>): DomainFrontmatter {
  const flat = frontmatter ?? {};
  const tagValue = flat.tags;
  const tags =
    typeof tagValue === 'string'
      ? [tagValue]
      : Array.isArray(tagValue)
        ? tagValue.filter((value): value is string => typeof value === 'string')
        : [];

  return {
    flat,
    nested: flat,
    tags,
  };
}

function summarizeMetrics(
  runs: PublicationBenchmarkRun[],
  reducer: (values: number[]) => number
): PublicationBenchmarkMetricSummary {
  return {
    time_to_first_request_ms: reducer(runs.map((run) => run.timings.time_to_first_request_ms)),
    parse_and_transform_duration_ms: reducer(
      runs.map((run) => run.timings.parse_and_transform_duration_ms)
    ),
    dedup_duration_ms: reducer(runs.map((run) => run.timings.dedup_duration_ms)),
    callout_style_loading_duration_ms: reducer(
      runs.map((run) => run.timings.callout_style_loading_duration_ms)
    ),
    note_hash_filter_duration_ms: reducer(
      runs.map((run) => run.timings.note_hash_filter_duration_ms)
    ),
    notes_batch_info_duration_ms: reducer(
      runs.map((run) => run.timings.notes_batch_info_duration_ms)
    ),
    asset_batch_info_duration_ms: reducer(
      runs.map((run) => run.timings.asset_batch_info_duration_ms)
    ),
    asset_upload_prep_duration_ms: reducer(
      runs.map((run) => run.timings.asset_upload_prep_duration_ms)
    ),
    notes_upload_duration_ms: reducer(runs.map((run) => run.timings.notes_upload_duration_ms)),
    assets_upload_duration_ms: reducer(runs.map((run) => run.timings.assets_upload_duration_ms)),
    finish_session_duration_ms: reducer(runs.map((run) => run.timings.finish_session_duration_ms)),
    total_publication_duration_ms: reducer(
      runs.map((run) => run.timings.total_publication_duration_ms)
    ),
    chunk_prepare_duration_ms: reducer(runs.map((run) => run.timings.chunk_prepare_duration_ms)),
    notes_upload_json_bytes: reducer(runs.map((run) => run.payloadSizes.notes_upload_json_bytes)),
    assets_upload_json_bytes: reducer(runs.map((run) => run.payloadSizes.assets_upload_json_bytes)),
    uploaded_note_count: reducer(runs.map((run) => run.uploadedNoteCount)),
    skipped_note_count: reducer(runs.map((run) => run.skippedNoteCount)),
  };
}

function calculateMetricDeltas(
  baseline: PublicationBenchmarkMetricSummary,
  candidate: PublicationBenchmarkMetricSummary
): Partial<Record<keyof PublicationBenchmarkMetricSummary, number>> {
  const deltas: Partial<Record<keyof PublicationBenchmarkMetricSummary, number>> = {};
  for (const key of Object.keys(baseline) as Array<keyof PublicationBenchmarkMetricSummary>) {
    deltas[key] = Number((candidate[key] - baseline[key]).toFixed(2));
  }
  return deltas;
}

function averageReducer(values: number[]): number {
  return Number(
    (values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)).toFixed(2)
  );
}

function minReducer(values: number[]): number {
  return Number(Math.min(...values).toFixed(2));
}

function maxReducer(values: number[]): number {
  return Number(Math.max(...values).toFixed(2));
}

function resolveFixturesDir(): string {
  return path.join(resolveBenchAssetsRoot(), 'fixtures');
}

function resolveBenchAssetsRoot(): string {
  const sourceAssetsRoot = path.join(
    process.cwd(),
    'apps',
    'node',
    'src',
    'assets',
    'publication-trace-bench'
  );
  if (existsSync(sourceAssetsRoot)) {
    return sourceAssetsRoot;
  }

  const builtAssetsRoot = path.join(__dirname, '..', 'assets', 'publication-trace-bench');
  if (existsSync(builtAssetsRoot)) {
    return builtAssetsRoot;
  }

  return sourceAssetsRoot;
}

function detectGitRevision(): string {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

function guessMimeType(fileName: string): string {
  switch (path.extname(fileName).toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.svg':
      return 'image/svg+xml';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

function byteSize(value: string): number {
  return new TextEncoder().encode(value).length;
}

function jsonByteSize(value: unknown): number {
  return byteSize(JSON.stringify(value));
}

function computeSourceHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function sumObjectValues(values: Record<string, number> | undefined): number {
  return Number(
    Object.values(values ?? {})
      .reduce((sum, value) => sum + value, 0)
      .toFixed(2)
  );
}

function formatDelta(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return 'n/a';
  }
  return value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}
