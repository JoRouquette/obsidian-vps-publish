import type { IgnoreRule, PublishableNote, ResolvedAssetFile, VpsConfig } from '@core-domain';
import type { FinalizationPhase } from '@core-domain/entities/finalization-phase';

export interface PublicationBenchmarkFixture {
  id: string;
  description: string;
  version: string;
  deduplicationEnabled?: boolean;
  calloutStylePaths?: string[];
  ignoredTags?: string[];
  ignoreRules?: IgnoreRule[];
  cleanupRules?: NonNullable<VpsConfig['cleanupRules']>;
  existingPublication?: PublicationBenchmarkExistingPublication;
  notes: PublicationBenchmarkCollectedNote[];
  assets?: PublicationBenchmarkAsset[];
}

export interface PublicationBenchmarkExistingPublication {
  pipelineState?: 'unchanged' | 'changed';
  unchangedNoteIds?: string[];
  missingHashNoteIds?: string[];
}

export interface PublicationBenchmarkCollectedNote {
  noteId: string;
  title: string;
  vaultPath: string;
  relativePath: string;
  content: string;
  frontmatter?: Record<string, unknown>;
  folderConfig: {
    id: string;
    vaultFolder: string;
    routeBase: string;
    vpsId: string;
    ignoredCleanupRuleIds?: string[];
    displayName?: string;
    customIndexFile?: string;
  };
}

export interface PublicationBenchmarkAsset {
  relativeAssetPath: string;
  vaultPath: string;
  fileName: string;
  mimeType?: string;
  contentBase64: string;
}

export type PublicationBenchmarkMode = 'pipeline-unchanged' | 'pipeline-changed';

export interface PublicationBenchmarkRun {
  fixtureId: string;
  fixtureVersion: string;
  fixtureDescription: string;
  mode: PublicationBenchmarkMode;
  uploadRunId: string;
  sessionId: string;
  jobId: string;
  contentRevision?: string;
  noteCount: number;
  assetCount: number;
  publishableNoteCount: number;
  uploadedNoteCount: number;
  skippedNoteCount: number;
  uploadedAssetCount: number;
  deduplicationEnabled: boolean;
  deduplication: {
    pipelineChanged: boolean;
    noteHashFilterApplied: boolean;
    skipStrategy: 'none' | 'source-hash-by-vault-path';
  };
  timings: {
    publication_start_epoch_ms: number;
    time_to_first_request_ms: number;
    start_session_duration_ms: number;
    parse_and_transform_duration_ms: number;
    dedup_duration_ms: number;
    callout_style_loading_duration_ms: number;
    note_hash_filter_duration_ms: number;
    notes_batch_info_duration_ms: number;
    asset_batch_info_duration_ms: number;
    asset_upload_prep_duration_ms: number;
    notes_upload_duration_ms: number;
    assets_upload_duration_ms: number;
    finish_session_duration_ms: number;
    total_publication_duration_ms: number;
    chunk_prepare_duration_ms: number;
  };
  payloadSizes: {
    notes_upload_json_bytes: number;
    assets_upload_json_bytes: number;
    notes_chunk_count: number;
    assets_chunk_count: number;
    notes_chunk_request_bytes: number;
    assets_chunk_request_bytes: number;
  };
  finalization: {
    status: 'completed' | 'failed';
    phaseTimings: Partial<Record<FinalizationPhase, number>>;
    total_phase_duration_ms: number;
  };
}

export interface PublicationBenchmarkAggregate {
  fixtureId: string;
  mode: PublicationBenchmarkMode;
  iterations: number;
  noteCount: number;
  assetCount: number;
  average: PublicationBenchmarkMetricSummary;
  min: PublicationBenchmarkMetricSummary;
  max: PublicationBenchmarkMetricSummary;
  samples: PublicationBenchmarkRun[];
}

export interface PublicationBenchmarkMetricSummary {
  time_to_first_request_ms: number;
  parse_and_transform_duration_ms: number;
  dedup_duration_ms: number;
  callout_style_loading_duration_ms: number;
  note_hash_filter_duration_ms: number;
  notes_batch_info_duration_ms: number;
  asset_batch_info_duration_ms: number;
  asset_upload_prep_duration_ms: number;
  notes_upload_duration_ms: number;
  assets_upload_duration_ms: number;
  finish_session_duration_ms: number;
  total_publication_duration_ms: number;
  chunk_prepare_duration_ms: number;
  notes_upload_json_bytes: number;
  assets_upload_json_bytes: number;
  uploaded_note_count: number;
  skipped_note_count: number;
}

export interface PublicationBenchmarkReport {
  generatedAt: string;
  gitRevision: string;
  nodeVersion: string;
  platform: string;
  iterations: number;
  fixtureIds: string[];
  mode: 'pipeline-unchanged' | 'pipeline-changed' | 'both';
  aggregates: PublicationBenchmarkAggregate[];
  comparisons: PublicationBenchmarkModeComparison[];
}

export interface PublicationBenchmarkModeComparison {
  fixtureId: string;
  pipelineUnchanged?: PublicationBenchmarkAggregate;
  pipelineChanged?: PublicationBenchmarkAggregate;
  deltas?: Partial<Record<keyof PublicationBenchmarkMetricSummary, number>>;
}

export interface PublicationBenchmarkCompareReport {
  generatedAt: string;
  baselineRevision: string;
  candidateRevision: string;
  fixtureIds: string[];
  comparisons: PublicationBenchmarkRevisionComparison[];
}

export interface PublicationBenchmarkRevisionComparison {
  fixtureId: string;
  mode: PublicationBenchmarkMode;
  baseline?: PublicationBenchmarkAggregate;
  candidate?: PublicationBenchmarkAggregate;
  deltas?: Partial<Record<keyof PublicationBenchmarkMetricSummary, number>>;
}

export interface PreparedPublicationFixture {
  fixture: PublicationBenchmarkFixture;
  notes: PublishableNote[];
  assets: ResolvedAssetFile[];
}
