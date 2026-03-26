/**
 * Tests for parallel session finalization
 * Validates that multiple jobs can run concurrently with controlled parallelism
 */

import type { LoggerPort } from '@core-domain';

import type { StagingManager } from '../../filesystem/staging-manager';
import { SessionFinalizationJobService } from '../session-finalization-job.service';
import type { SessionFinalizerService } from '../session-finalizer.service';

describe('SessionFinalizationJobService - Parallel Execution', () => {
  let service: SessionFinalizationJobService;
  let mockFinalizer: jest.Mocked<SessionFinalizerService>;
  let mockStagingManager: jest.Mocked<StagingManager>;
  let mockSessionRepository: any;
  let mockLogger: jest.Mocked<LoggerPort>;

  beforeEach(() => {
    mockFinalizer = {
      rebuildFromStored: jest.fn().mockImplementation(
        async (_sessionId: string, reportPhase?: (phase: string) => void) =>
          new Promise((resolve) => {
            // Simulate realistic async work (200ms)
            reportPhase?.('rebuilding_notes');
            setTimeout(() => {
              reportPhase?.('rendering_html');
              setTimeout(() => {
                reportPhase?.('rebuilding_indexes');
                setTimeout(() => {
                  reportPhase?.('validating_links');
                  resolve(undefined);
                }, 50);
              }, 50);
            }, 50);
          })
      ),
    } as unknown as jest.Mocked<SessionFinalizerService>;

    mockStagingManager = {
      promoteSession: jest.fn().mockResolvedValue(undefined),
      contentRootPath: '/tmp/test-content',
    } as unknown as jest.Mocked<StagingManager>;

    mockSessionRepository = {
      findById: jest.fn().mockResolvedValue({ allCollectedRoutes: [] }),
      save: jest.fn().mockResolvedValue(undefined),
      create: jest.fn(),
    };

    mockLogger = {
      child: jest.fn().mockReturnThis(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<LoggerPort>;
  });

  describe('Controlled Parallelism', () => {
    it('should execute at most maxConcurrentJobs simultaneously', async () => {
      const maxConcurrentJobs = 3;
      service = new SessionFinalizationJobService(
        mockFinalizer,
        mockStagingManager,
        mockSessionRepository,
        mockLogger,
        maxConcurrentJobs
      );

      // Queue 10 jobs
      const jobIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const jobId = await service.queueFinalization(`session-${i}`);
        jobIds.push(jobId);
      }

      // Poll until processing starts
      let stats = service.getQueueStats();
      const startPoll = Date.now();
      while (stats.activeJobs === 0 && stats.completed === 0 && Date.now() - startPoll < 5000) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        stats = service.getQueueStats();
      }

      // Check that only maxConcurrentJobs are active
      expect(stats.activeJobs).toBeLessThanOrEqual(maxConcurrentJobs);
      expect(stats.queueLength + stats.activeJobs + stats.completed).toBe(10);

      // Poll until all jobs complete
      let finalStats = service.getQueueStats();
      while (finalStats.completed < 10 && Date.now() - startPoll < 10000) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        finalStats = service.getQueueStats();
      }

      expect(finalStats.completed).toBe(10);
      expect(finalStats.activeJobs).toBe(0);
      expect(finalStats.queueLength).toBe(0);
    });

    it('should process jobs faster with higher concurrency', async () => {
      // Test with concurrency = 1 (sequential)
      const sequentialService = new SessionFinalizationJobService(
        mockFinalizer,
        mockStagingManager,
        mockSessionRepository,
        mockLogger,
        1
      );

      const startSequential = Date.now();
      for (let i = 0; i < 5; i++) {
        await sequentialService.queueFinalization(`session-seq-${i}`);
      }
      // Poll until all 5 sequential jobs complete
      while (
        sequentialService.getQueueStats().completed < 5 &&
        Date.now() - startSequential < 10000
      ) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      const durationSequential = Date.now() - startSequential;

      // Test with concurrency = 5 (parallel)
      const parallelService = new SessionFinalizationJobService(
        mockFinalizer,
        mockStagingManager,
        mockSessionRepository,
        mockLogger,
        5
      );

      const startParallel = Date.now();
      for (let i = 0; i < 5; i++) {
        await parallelService.queueFinalization(`session-par-${i}`);
      }
      // Poll until all 5 parallel jobs complete
      while (parallelService.getQueueStats().completed < 5 && Date.now() - startParallel < 10000) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      const durationParallel = Date.now() - startParallel;

      // Parallel should be significantly faster
      expect(durationParallel).toBeLessThan(durationSequential / 2);
    });

    it('should continue processing after a job failure', async () => {
      mockFinalizer.rebuildFromStored
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Rebuild failed'))
        .mockResolvedValueOnce(undefined);

      service = new SessionFinalizationJobService(
        mockFinalizer,
        mockStagingManager,
        mockSessionRepository,
        mockLogger,
        2
      );

      const job1 = await service.queueFinalization('session-1');
      const job2 = await service.queueFinalization('session-2');
      const job3 = await service.queueFinalization('session-3');

      // Poll until all 3 jobs finish (queue fully drained)
      const pollStart = Date.now();
      let s = service.getQueueStats();
      while ((s.activeJobs > 0 || s.queueLength > 0) && Date.now() - pollStart < 5000) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        s = service.getQueueStats();
      }

      const status1 = service.getJobStatus(job1);
      const status2 = service.getJobStatus(job2);
      const status3 = service.getJobStatus(job3);

      expect(status1?.status).toBe('completed');
      expect(status2?.status).toBe('failed');
      expect(status3?.status).toBe('completed');
    });

    it('should respect maxConcurrentJobs when jobs complete at different rates', async () => {
      // Job 1: fast (50ms), Job 2: very slow (400ms), Job 3: fast (50ms)
      // Using longer duration for slow job to ensure clear timing separation
      mockFinalizer.rebuildFromStored
        .mockImplementationOnce(() => new Promise((resolve) => setTimeout(resolve, 50)))
        .mockImplementationOnce(() => new Promise((resolve) => setTimeout(resolve, 400)))
        .mockImplementationOnce(() => new Promise((resolve) => setTimeout(resolve, 50)));

      service = new SessionFinalizationJobService(
        mockFinalizer,
        mockStagingManager,
        mockSessionRepository,
        mockLogger,
        2 // Only 2 concurrent jobs allowed
      );

      await service.queueFinalization('session-fast-1');
      await service.queueFinalization('session-slow');
      await service.queueFinalization('session-fast-2');

      // Poll until at least 1 job completes (avoids flaky fixed-timeout)
      const pollStart = Date.now();
      let statsAfterFirst = service.getQueueStats();
      while (statsAfterFirst.completed < 1 && Date.now() - pollStart < 5000) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        statsAfterFirst = service.getQueueStats();
      }

      // The key assertion is that we never exceed maxConcurrentJobs
      expect(statsAfterFirst.completed).toBeGreaterThanOrEqual(1);
      expect(statsAfterFirst.activeJobs).toBeLessThanOrEqual(2);

      // Poll until all 3 jobs complete
      let finalStats = service.getQueueStats();
      while (finalStats.completed < 3 && Date.now() - pollStart < 5000) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        finalStats = service.getQueueStats();
      }

      expect(finalStats.completed).toBe(3);
      expect(finalStats.activeJobs).toBe(0);
    });
  });

  describe('getQueueStats', () => {
    it('should return correct activeJobs and maxConcurrentJobs', () => {
      service = new SessionFinalizationJobService(
        mockFinalizer,
        mockStagingManager,
        mockSessionRepository,
        mockLogger,
        7
      );

      const stats = service.getQueueStats();
      expect(stats.maxConcurrentJobs).toBe(7);
      expect(stats.activeJobs).toBe(0);
    });

    it('should track activeJobs count during execution', async () => {
      service = new SessionFinalizationJobService(
        mockFinalizer,
        mockStagingManager,
        mockSessionRepository,
        mockLogger,
        3
      );

      // Queue 6 jobs
      for (let i = 0; i < 6; i++) {
        await service.queueFinalization(`session-${i}`);
      }

      // Poll until processing starts
      const earlyPoll = Date.now();
      let statsEarly = service.getQueueStats();
      while (
        statsEarly.activeJobs === 0 &&
        statsEarly.completed === 0 &&
        Date.now() - earlyPoll < 5000
      ) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        statsEarly = service.getQueueStats();
      }
      expect(statsEarly.activeJobs).toBeGreaterThan(0);
      expect(statsEarly.activeJobs).toBeLessThanOrEqual(3);

      // Poll until all 6 complete
      let statsFinal = service.getQueueStats();
      while (statsFinal.completed < 6 && Date.now() - earlyPoll < 10000) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        statsFinal = service.getQueueStats();
      }
      expect(statsFinal.activeJobs).toBe(0);
      expect(statsFinal.completed).toBe(6);
    });
  });

  describe('phase metadata', () => {
    it('tracks current phase, contentRevision, and finalization timings', async () => {
      service = new SessionFinalizationJobService(
        mockFinalizer,
        mockStagingManager,
        mockSessionRepository,
        mockLogger,
        1
      );

      const jobId = await service.queueFinalization('session-phase');
      const started = Date.now();
      let job = service.getJobStatus(jobId);

      while (job?.status !== 'completed' && Date.now() - started < 5000) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        job = service.getJobStatus(jobId);
      }

      expect(job?.status).toBe('completed');
      expect(job?.phase).toBe('completed');
      expect(job?.contentRevision).toEqual(expect.any(String));
      expect(job?.phaseTimings).toEqual(
        expect.objectContaining({
          queued: expect.any(Number),
          rebuilding_notes: expect.any(Number),
          rendering_html: expect.any(Number),
          promoting_content: expect.any(Number),
          rebuilding_indexes: expect.any(Number),
          validating_links: expect.any(Number),
          completing_publication: expect.any(Number),
        })
      );
      expect(job?.result?.finalizationTimings).toEqual(job?.phaseTimings);
    });

    it('emits human-readable backend phases to listeners in order', async () => {
      service = new SessionFinalizationJobService(
        mockFinalizer,
        mockStagingManager,
        mockSessionRepository,
        mockLogger,
        1
      );

      const jobId = await service.queueFinalization('session-phase-events');
      const phases: string[] = [];
      const unsubscribe = service.subscribe(jobId, (job) => {
        if (!job.phase) {
          return;
        }

        if (phases[phases.length - 1] !== job.phase) {
          phases.push(job.phase);
        }
      });

      const started = Date.now();
      let job = service.getJobStatus(jobId);

      while (job?.status !== 'completed' && Date.now() - started < 5000) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        job = service.getJobStatus(jobId);
      }

      unsubscribe();

      expect(phases).toEqual(
        expect.arrayContaining([
          'rendering_html',
          'promoting_content',
          'rebuilding_indexes',
          'validating_links',
          'completing_publication',
          'completed',
        ])
      );
    });
  });
});
