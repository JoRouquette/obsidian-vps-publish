/**
 * Session Finalization Job Service
 * Offloads heavy session finalization work to background processing
 * Returns 202 Accepted immediately, allowing clients to poll for status
 */

import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { type SessionRepository } from '@core-application';
import { type ContentSearchIndex, type LoggerPort, type PromotionStats } from '@core-domain';

import { ManifestFileSystem } from '../filesystem/manifest-file-system';
import { type StagingManager } from '../filesystem/staging-manager';
import { ContentSearchIndexer } from '../search/content-search-indexer';
import { type SessionFinalizerService } from './session-finalizer.service';

export interface FinalizationJob {
  jobId: string;
  sessionId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  phase?: FinalizationPhase;
  phaseTimings?: Partial<Record<FinalizationPhase, number>>;
  contentRevision?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: {
    notesProcessed: number;
    assetsProcessed: number;
    promotionStats?: PromotionStats;
    /** Unique revision identifier for this publication. */
    contentRevision?: string;
    finalizationTimings?: Partial<Record<FinalizationPhase, number>>;
  };
}

export type FinalizationPhase =
  | 'queued'
  | 'load_session'
  | 'rebuild_from_stored'
  | 'promote_session'
  | 'rebuild_html_indexes'
  | 'rebuild_search_index'
  | 'validate_post_promotion'
  | 'trigger_completion_callbacks'
  | 'completed'
  | 'failed';

export interface FinalizationJobHistoryEntry {
  jobId: string;
  sessionId: string;
  status: FinalizationJob['status'];
  progress: number;
  phase?: FinalizationPhase;
  phaseTimings?: Partial<Record<FinalizationPhase, number>>;
  contentRevision?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  result?: FinalizationJob['result'];
}

export type FinalizationJobListener = (job: FinalizationJob) => void;

export class SessionFinalizationJobService {
  private jobs: Map<string, FinalizationJob> = new Map();
  private processingQueue: string[] = [];
  private activeJobs = 0;
  private maxConcurrentJobs: number;
  private completionCallbacks: Array<() => Promise<void>> = [];
  private readonly historyFilePath: string;
  private readonly listenersByJobId = new Map<string, Set<FinalizationJobListener>>();

  constructor(
    private readonly sessionFinalizer: SessionFinalizerService,
    private readonly stagingManager: StagingManager,
    private readonly sessionRepository: SessionRepository, // PHASE 6.1
    private readonly logger?: LoggerPort,
    maxConcurrentJobs?: number
  ) {
    this.maxConcurrentJobs = maxConcurrentJobs ?? 5;
    this.historyFilePath = path.join(
      this.stagingManager.contentRootPath,
      '.admin',
      'finalization-history.jsonl'
    );
  }

  /**
   * Register a callback to be called when a job completes successfully.
   * Used for content version updates after publication.
   */
  onJobCompleted(callback: () => Promise<void>): void {
    this.completionCallbacks.push(callback);
  }

  /**
   * Queue a session finalization job
   * Returns job ID immediately for status polling
   */
  async queueFinalization(sessionId: string): Promise<string> {
    const jobId = randomUUID();

    const job: FinalizationJob = {
      jobId,
      sessionId,
      status: 'pending',
      progress: 0,
      phase: 'queued',
      phaseTimings: {},
      createdAt: new Date(),
    };

    this.jobs.set(jobId, job);
    this.processingQueue.push(jobId);
    this.notifyListeners(job);

    this.logger?.info('[JOB] Finalization job queued', {
      jobId,
      sessionId,
      queueLength: this.processingQueue.length,
    });

    // Start processing if not already running
    void this.processQueue();

    return jobId;
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): FinalizationJob | undefined {
    return this.jobs.get(jobId);
  }

  subscribe(jobId: string, listener: FinalizationJobListener): () => void {
    const listeners = this.listenersByJobId.get(jobId) ?? new Set<FinalizationJobListener>();
    listeners.add(listener);
    this.listenersByJobId.set(jobId, listeners);

    return () => {
      const currentListeners = this.listenersByJobId.get(jobId);
      if (!currentListeners) {
        return;
      }

      currentListeners.delete(listener);
      if (currentListeners.size === 0) {
        this.listenersByJobId.delete(jobId);
      }
    };
  }

  getListenerCount(jobId: string): number {
    return this.listenersByJobId.get(jobId)?.size ?? 0;
  }

  /**
   * Get job by session ID (for backwards compatibility)
   */
  getJobBySessionId(sessionId: string): FinalizationJob | undefined {
    for (const job of this.jobs.values()) {
      if (job.sessionId === sessionId) {
        return job;
      }
    }
    return undefined;
  }

  getRecentJobs(limit = 20): FinalizationJob[] {
    return [...this.jobs.values()]
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, limit)
      .map((job) => ({
        ...job,
        createdAt: new Date(job.createdAt),
        startedAt: job.startedAt ? new Date(job.startedAt) : undefined,
        completedAt: job.completedAt ? new Date(job.completedAt) : undefined,
      }));
  }

  async getPersistedHistory(limit = 20): Promise<FinalizationJobHistoryEntry[]> {
    try {
      const raw = await fs.readFile(this.historyFilePath, 'utf8');
      return raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .reverse()
        .map((line) => JSON.parse(line) as FinalizationJobHistoryEntry)
        .slice(0, limit);
    } catch (error) {
      const code = (error as { code?: string } | undefined)?.code;
      if (code !== 'ENOENT') {
        this.logger?.warn('[JOB] Failed to read persisted finalization history', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return [];
    }
  }

  /**
   * Wait for job completion (blocking call with timeout)
   * Polls job status every 500ms until completed/failed or timeout
   * @param jobId - Job identifier
   * @param timeoutMs - Timeout in milliseconds (default: 120000 = 2 minutes)
   * @returns Completed job
   * @throws Error if job not found, timed out, or failed
   */
  async waitForJob(jobId: string, timeoutMs = 120000): Promise<FinalizationJob> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const startTime = Date.now();
    const pollIntervalMs = 500;

    while (true) {
      const currentJob = this.jobs.get(jobId);
      if (!currentJob) {
        throw new Error(`Job lost during wait: ${jobId}`);
      }

      if (currentJob.status === 'completed') {
        await new Promise((resolve) => setTimeout(resolve, 0));
        return currentJob;
      }

      if (currentJob.status === 'failed') {
        throw new Error(`Job failed: ${currentJob.error ?? 'Unknown error'}`);
      }

      const elapsed = Date.now() - startTime;
      if (elapsed >= timeoutMs) {
        throw new Error(`Job timeout after ${timeoutMs}ms: ${jobId}`);
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  /**
   * Process queued jobs with controlled parallelism (avoid excessive concurrent finalization)
   */
  private async processQueue(): Promise<void> {
    // Start as many jobs as allowed by concurrency limit
    while (this.processingQueue.length > 0 && this.activeJobs < this.maxConcurrentJobs) {
      const jobId = this.processingQueue.shift()!;
      const job = this.jobs.get(jobId);

      if (!job) {
        this.logger?.warn('[JOB] Job not found in queue', { jobId });
        continue;
      }

      this.activeJobs++;
      this.logger?.debug('[JOB] Starting job execution', {
        jobId,
        activeJobs: this.activeJobs,
        queueLength: this.processingQueue.length,
      });

      // Execute job asynchronously (non-blocking)
      this.executeJob(job)
        .then(() => {
          this.activeJobs--;
          this.logger?.debug('[JOB] Job execution completed', {
            jobId,
            activeJobs: this.activeJobs,
            queueLength: this.processingQueue.length,
          });
          // Continue processing queue if there are more jobs
          void this.processQueue();
        })
        .catch((err) => {
          this.activeJobs--;
          this.logger?.error('[JOB] Unexpected error in job execution', { jobId, err });
          // Continue processing queue even on error
          void this.processQueue();
        });
    }
  }

  /**
   * Execute a single finalization job
   */
  private async executeJob(job: FinalizationJob): Promise<void> {
    const startTime = Date.now();
    const contentRevision = randomUUID();

    job.status = 'processing';
    job.startedAt = new Date();
    job.contentRevision = contentRevision;
    this.setJobPhase(job, 'load_session', 10);

    this.logger?.info('[JOB] Starting finalization job', {
      jobId: job.jobId,
      sessionId: job.sessionId,
      contentRevision,
      activeJobs: this.activeJobs,
      queueLength: this.processingQueue.length,
    });

    try {
      // STEP 0: Load session to get allCollectedRoutes and pipelineSignature (PHASE 6.1, PHASE 7)
      const session = await this.measurePhase(job, 'load_session', 10, async () =>
        this.sessionRepository.findById(job.sessionId)
      );
      const allCollectedRoutes = session?.allCollectedRoutes;
      const pipelineSignature = session?.pipelineSignature;

      // STEP 0.5: Validate upload completeness (informational, non-blocking)
      if (session) {
        const { notesPlanned, notesProcessed, assetsPlanned, assetsProcessed } = session;
        if (notesProcessed < notesPlanned || assetsProcessed < assetsPlanned) {
          this.logger?.warn('[JOB] Upload count mismatch detected', {
            contentRevision,
            sessionId: job.sessionId,
            notesPlanned,
            notesProcessed,
            assetsPlanned,
            assetsProcessed,
          });
        }
      }

      // STEP 1: Rebuild from stored notes (heaviest operation)
      const customIndexesHtml = await this.measurePhase(job, 'rebuild_from_stored', 20, async () =>
        this.sessionFinalizer.rebuildFromStored(job.sessionId)
      );

      // STEP 2: Promote staging to production (with deleted page detection and pipelineSignature injection)
      const promotionStats = await this.measurePhase(job, 'promote_session', 85, async () =>
        this.stagingManager.promoteSession(
          job.sessionId,
          allCollectedRoutes,
          pipelineSignature,
          session?.locale,
          contentRevision
        )
      );

      // STEP 2.5: Rebuild HTML indexes from PRODUCTION manifest (after merge)
      // CRITICAL: rebuildFromStored writes indexes to staging using only the
      // current session's pages. After promoteSession merges staging + production
      // manifests, we must regenerate indexes so they reflect ALL pages.
      await this.measurePhase(job, 'rebuild_html_indexes', 90, async () =>
        this.rebuildProductionHtmlIndexes(customIndexesHtml)
      );

      // STEP 3: Rebuild search index from PRODUCTION manifest (after merge)
      // CRITICAL: This must happen AFTER promoteSession to include all pages
      // (staging pages + unchanged production pages from deduplication)
      await this.measurePhase(job, 'rebuild_search_index', 92, async () =>
        this.rebuildProductionSearchIndex(contentRevision)
      );

      // STEP 4: Validate post-promotion consistency (manifest vs search index)
      await this.measurePhase(job, 'validate_post_promotion', 95, async () =>
        this.validatePostPromotion()
      );
      // Trigger completion callbacks before exposing the job as completed so
      // queue stats only count fully finalized publications.
      await this.measurePhase(job, 'trigger_completion_callbacks', 98, async () =>
        this.triggerCompletionCallbacks()
      );

      const completedAt = new Date();
      const result: FinalizationJob['result'] = {
        notesProcessed: session?.notesProcessed ?? 0,
        assetsProcessed: session?.assetsProcessed ?? 0,
        promotionStats,
        contentRevision,
        finalizationTimings: { ...(job.phaseTimings ?? {}) },
      };

      job.progress = 100;
      job.phase = 'completed';
      job.result = result;
      job.completedAt = completedAt;
      job.status = 'completed';
      this.notifyListeners(job);
      await this.appendHistory(job);

      const totalDuration = Date.now() - startTime;
      this.logger?.info('[JOB] Finalization job completed', {
        jobId: job.jobId,
        sessionId: job.sessionId,
        contentRevision,
        durationMs: totalDuration,
        phaseTimings: job.phaseTimings,
        activeJobs: this.activeJobs,
      });
    } catch (error) {
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.completedAt = new Date();
      job.status = 'failed';
      job.phase = 'failed';
      this.notifyListeners(job);
      await this.appendHistory(job);

      const totalDuration = Date.now() - startTime;
      this.logger?.error('[JOB] Finalization job failed', {
        jobId: job.jobId,
        sessionId: job.sessionId,
        contentRevision,
        error: job.error,
        durationMs: totalDuration,
        phaseTimings: job.phaseTimings,
      });
    }
  }

  /**
   * Clean up old completed/failed jobs (call periodically)
   */
  cleanupOldJobs(maxAgeMs: number = 3600000): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      const isOld = job.completedAt && now - job.completedAt.getTime() > maxAgeMs;

      if (isOld) {
        this.jobs.delete(jobId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger?.debug('[JOB] Cleaned up old finalization jobs', {
        cleaned,
        remaining: this.jobs.size,
      });
    }
  }

  /**
   * Trigger all registered completion callbacks.
   * Called after successful job completion.
   */
  private async triggerCompletionCallbacks(): Promise<void> {
    if (this.completionCallbacks.length === 0) {
      return;
    }

    this.logger?.debug('[JOB] Triggering completion callbacks', {
      callbackCount: this.completionCallbacks.length,
    });

    for (const callback of this.completionCallbacks) {
      try {
        await callback();
      } catch (error) {
        this.logger?.error('[JOB] Error in completion callback', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async appendHistory(job: FinalizationJob): Promise<void> {
    const entry: FinalizationJobHistoryEntry = {
      jobId: job.jobId,
      sessionId: job.sessionId,
      status: job.status,
      progress: job.progress,
      phase: job.phase,
      phaseTimings: job.phaseTimings,
      contentRevision: job.contentRevision,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      error: job.error,
      result: job.result,
    };

    await fs.mkdir(path.dirname(this.historyFilePath), { recursive: true });
    await fs.appendFile(this.historyFilePath, `${JSON.stringify(entry)}\n`, 'utf8');
  }

  private notifyListeners(job: FinalizationJob): void {
    const listeners = this.listenersByJobId.get(job.jobId);
    if (!listeners || listeners.size === 0) {
      return;
    }

    for (const listener of listeners) {
      try {
        listener(job);
      } catch (error) {
        this.logger?.warn('[JOB] Listener notification failed', {
          jobId: job.jobId,
          sessionId: job.sessionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private setJobPhase(job: FinalizationJob, phase: FinalizationPhase, progress: number): void {
    job.phase = phase;
    job.progress = progress;
    this.notifyListeners(job);
  }

  private async measurePhase<T>(
    job: FinalizationJob,
    phase: FinalizationPhase,
    progress: number,
    action: () => Promise<T>
  ): Promise<T> {
    this.setJobPhase(job, phase, progress);
    const startedAt = Date.now();

    try {
      return await action();
    } finally {
      const durationMs = Date.now() - startedAt;
      job.phaseTimings = {
        ...(job.phaseTimings ?? {}),
        [phase]: durationMs,
      };
      this.logger?.debug('[JOB] Finalization phase measured', {
        jobId: job.jobId,
        sessionId: job.sessionId,
        phase,
        durationMs,
        contentRevision: job.contentRevision,
      });
    }
  }

  /**
   * Rebuild the search index from the PRODUCTION manifest.
   * Called after promoteSession() to ensure all pages (including dedup'd ones) are indexed.
   */
  private async rebuildProductionSearchIndex(contentRevision?: string): Promise<void> {
    const contentRoot = this.stagingManager.contentRootPath;
    const manifestStorage = new ManifestFileSystem(contentRoot, this.logger);
    const manifest = await manifestStorage.load();

    if (!manifest) {
      this.logger?.warn('[JOB] No production manifest found; skipping search index rebuild');
      return;
    }

    const indexer = new ContentSearchIndexer(contentRoot, this.logger);
    await indexer.build(manifest, contentRevision);
    this.logger?.info('[JOB] Production search index rebuilt', {
      pageCount: manifest.pages.length,
      contentRevision,
    });
  }

  /**
   * Rebuild HTML index files (root + folder indexes) from the PRODUCTION manifest.
   * Called after promoteSession() so indexes reflect all pages (staging + production merged).
   */
  private async rebuildProductionHtmlIndexes(
    customIndexesHtml?: Map<string, string>
  ): Promise<void> {
    const contentRoot = this.stagingManager.contentRootPath;
    const manifestStorage = new ManifestFileSystem(contentRoot, this.logger);
    const manifest = await manifestStorage.load();

    if (!manifest) {
      this.logger?.warn('[JOB] No production manifest found; skipping HTML index rebuild');
      return;
    }

    await manifestStorage.rebuildIndex(manifest, customIndexesHtml);
    this.logger?.info('[JOB] Production HTML indexes rebuilt', {
      pageCount: manifest.pages.length,
    });
  }

  /**
   * Validate post-promotion consistency between manifest and search index.
   * Logs a warning if there's a mismatch but doesn't fail the job.
   */
  private async validatePostPromotion(): Promise<void> {
    const contentRoot = this.stagingManager.contentRootPath;

    try {
      // Load manifest
      const manifestStorage = new ManifestFileSystem(contentRoot, this.logger);
      const manifest = await manifestStorage.load();

      if (!manifest) {
        this.logger?.warn('[JOB] Validation skipped: no production manifest found');
        return;
      }

      // Load search index
      const indexPath = path.join(contentRoot, '_search-index.json');
      const indexRaw = await fs.readFile(indexPath, 'utf8');
      const searchIndex = JSON.parse(indexRaw) as ContentSearchIndex;

      // Compare counts
      const manifestPageCount = manifest.pages.length;
      const indexEntryCount = searchIndex.entries.length;

      if (manifestPageCount === indexEntryCount) {
        this.logger?.debug('[JOB] Post-promotion validation passed', {
          manifestPages: manifestPageCount,
          indexEntries: indexEntryCount,
        });
      } else {
        this.logger?.warn('[JOB] Post-promotion validation: manifest/index mismatch', {
          manifestPages: manifestPageCount,
          indexEntries: indexEntryCount,
          delta: manifestPageCount - indexEntryCount,
          missingRoutes: manifest.pages
            .filter((p) => !searchIndex.entries.some((e) => e.route === p.route))
            .map((p) => p.route)
            .slice(0, 10), // Log first 10 missing routes for debugging
        });
      }
    } catch (error) {
      // Non-fatal: log and continue
      this.logger?.warn('[JOB] Post-promotion validation failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get queue statistics
   */
  getQueueStats() {
    const stats = {
      totalJobs: this.jobs.size,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      queueLength: this.processingQueue.length,
      activeJobs: 0,
      maxConcurrentJobs: this.maxConcurrentJobs,
    };

    for (const job of this.jobs.values()) {
      stats[job.status]++;
    }

    stats.activeJobs = stats.processing;

    return stats;
  }
}
