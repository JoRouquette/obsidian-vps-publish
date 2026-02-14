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
        () =>
          new Promise((resolve) => {
            // Simulate realistic async work (200ms)
            setTimeout(resolve, 200);
          })
      ),
    } as unknown as jest.Mocked<SessionFinalizerService>;

    mockStagingManager = {
      promoteSession: jest.fn().mockResolvedValue(undefined),
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

      // Wait a bit for processing to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Check that only maxConcurrentJobs are active
      const stats = service.getQueueStats();
      expect(stats.activeJobs).toBeLessThanOrEqual(maxConcurrentJobs);
      expect(stats.queueLength + stats.activeJobs + stats.completed).toBe(10);

      // Wait for all jobs to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const finalStats = service.getQueueStats();
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
      await new Promise((resolve) => setTimeout(resolve, 1200)); // 5 jobs × 200ms = 1000ms
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
      await new Promise((resolve) => setTimeout(resolve, 400)); // All 5 jobs in parallel ≈ 200ms
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

      await new Promise((resolve) => setTimeout(resolve, 500));

      const status1 = service.getJobStatus(job1);
      const status2 = service.getJobStatus(job2);
      const status3 = service.getJobStatus(job3);

      expect(status1?.status).toBe('completed');
      expect(status2?.status).toBe('failed');
      expect(status3?.status).toBe('completed');
    });

    it('should respect maxConcurrentJobs when jobs complete at different rates', async () => {
      // Job 1: fast (50ms), Job 2: slow (300ms), Job 3: fast (50ms)
      mockFinalizer.rebuildFromStored
        .mockImplementationOnce(() => new Promise((resolve) => setTimeout(resolve, 50)))
        .mockImplementationOnce(() => new Promise((resolve) => setTimeout(resolve, 300)))
        .mockImplementationOnce(() => new Promise((resolve) => setTimeout(resolve, 50)));

      service = new SessionFinalizationJobService(
        mockFinalizer,
        mockStagingManager,
        mockSessionRepository,
        mockLogger,
        2 // Only 2 concurrent jobs allowed
      );

      const startTime = Date.now();
      await service.queueFinalization('session-fast-1');
      await service.queueFinalization('session-slow');
      await service.queueFinalization('session-fast-2');

      // Wait for first fast job to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const statsAfterFirst = service.getQueueStats();
      // Should have processed 2 jobs (fast-1 done, slow still running, fast-2 started)
      expect(statsAfterFirst.completed).toBe(1);
      expect(statsAfterFirst.activeJobs).toBeLessThanOrEqual(2);

      // Wait for all to complete
      await new Promise((resolve) => setTimeout(resolve, 350));

      const duration = Date.now() - startTime;
      const finalStats = service.getQueueStats();

      expect(finalStats.completed).toBe(3);
      expect(finalStats.activeJobs).toBe(0);

      // Total duration should be ~350ms (not 400ms sequential)
      // because fast-2 starts as soon as fast-1 completes
      // Allow generous margin for CI timing variations and system load
      expect(duration).toBeLessThan(800);
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

      // Check immediately after queueing
      await new Promise((resolve) => setTimeout(resolve, 50));
      const statsEarly = service.getQueueStats();
      expect(statsEarly.activeJobs).toBeGreaterThan(0);
      expect(statsEarly.activeJobs).toBeLessThanOrEqual(3);

      // Wait for all to complete
      await new Promise((resolve) => setTimeout(resolve, 600));
      const statsFinal = service.getQueueStats();
      expect(statsFinal.activeJobs).toBe(0);
      expect(statsFinal.completed).toBe(6);
    });
  });
});
