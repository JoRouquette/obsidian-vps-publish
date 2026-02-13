/**
 * Session Finalization Job Service
 * Offloads heavy session finalization work to background processing
 * Returns 202 Accepted immediately, allowing clients to poll for status
 */

import { type LoggerPort } from '@core-domain';
import { randomUUID } from 'crypto';

import { type SessionRepository } from '@core-application';
import { type StagingManager } from '../filesystem/staging-manager';
import { type SessionFinalizerService } from './session-finalizer.service';

export interface FinalizationJob {
  jobId: string;
  sessionId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: {
    notesProcessed: number;
    assetsProcessed: number;
  };
}

export class SessionFinalizationJobService {
  private jobs: Map<string, FinalizationJob> = new Map();
  private processingQueue: string[] = [];
  private activeJobs = 0;
  private maxConcurrentJobs: number;

  constructor(
    private readonly sessionFinalizer: SessionFinalizerService,
    private readonly stagingManager: StagingManager,
    private readonly sessionRepository: SessionRepository, // PHASE 6.1
    private readonly logger?: LoggerPort,
    maxConcurrentJobs?: number
  ) {
    this.maxConcurrentJobs = maxConcurrentJobs ?? 5;
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
      createdAt: new Date(),
    };

    this.jobs.set(jobId, job);
    this.processingQueue.push(jobId);

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
    const timings: Record<string, number> = {};

    job.status = 'processing';
    job.startedAt = new Date();
    job.progress = 10;

    this.logger?.info('[JOB] Starting finalization job', {
      jobId: job.jobId,
      sessionId: job.sessionId,
      activeJobs: this.activeJobs,
      queueLength: this.processingQueue.length,
    });

    try {
      // STEP 0: Load session to get allCollectedRoutes and pipelineSignature (PHASE 6.1, PHASE 7)
      const session = await this.sessionRepository.findById(job.sessionId);
      const allCollectedRoutes = session?.allCollectedRoutes;
      const pipelineSignature = session?.pipelineSignature;

      // STEP 1: Rebuild from stored notes (heaviest operation)
      job.progress = 20;
      const rebuildStart = Date.now();
      await this.sessionFinalizer.rebuildFromStored(job.sessionId);
      timings.rebuildFromStored = Date.now() - rebuildStart;
      job.progress = 80;

      // STEP 2: Promote staging to production (with deleted page detection and pipelineSignature injection)
      job.progress = 85;
      const promoteStart = Date.now();
      await this.stagingManager.promoteSession(
        job.sessionId,
        allCollectedRoutes,
        pipelineSignature
      );
      timings.promoteSession = Date.now() - promoteStart;
      job.progress = 100;

      // Mark as completed
      job.status = 'completed';
      job.completedAt = new Date();

      const totalDuration = Date.now() - startTime;
      this.logger?.info('[JOB] Finalization job completed', {
        jobId: job.jobId,
        sessionId: job.sessionId,
        durationMs: totalDuration,
        timings,
        activeJobs: this.activeJobs,
      });
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.completedAt = new Date();

      const totalDuration = Date.now() - startTime;
      this.logger?.error('[JOB] Finalization job failed', {
        jobId: job.jobId,
        sessionId: job.sessionId,
        error: job.error,
        durationMs: totalDuration,
        timings,
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
      activeJobs: this.activeJobs,
      maxConcurrentJobs: this.maxConcurrentJobs,
    };

    for (const job of this.jobs.values()) {
      stats[job.status]++;
    }

    return stats;
  }
}
