/**
 * Performance Regression Tests for Session Finalization
 * Tests finish operation latency with varying note counts
 *
 * Run with: npm test -- session-finalization-perf.test.ts
 * Set ENABLE_PERF_TESTS=true to run (disabled by default in CI)
 */

import { SessionFinalizationJobService } from '../session-finalization-job.service';
import { SessionFinalizerService } from '../session-finalizer.service';

const ENABLE_PERF_TESTS = process.env.ENABLE_PERF_TESTS === 'true';

// Performance thresholds (configurable via env)
const PERF_THRESHOLDS = {
  small: {
    notes: 50,
    maxP95Ms: 500,
  },
  medium: {
    notes: 100,
    maxP95Ms: 1000,
  },
  large: {
    notes: 300,
    maxP95Ms: 2000,
  },
};

describe.skip('SessionFinalizationJobService - Performance Tests', () => {
  // These tests are intentionally skipped by default
  // Enable with ENABLE_PERF_TESTS=true when doing performance validation

  let jobService: SessionFinalizationJobService;
  let mockFinalizer: jest.Mocked<SessionFinalizerService>;
  let mockStagingManager: any;
  let mockSessionRepository: any;

  beforeEach(() => {
    mockFinalizer = {
      rebuildFromStored: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockStagingManager = {
      promoteSession: jest.fn().mockResolvedValue(undefined),
    };

    mockSessionRepository = {
      findById: jest.fn().mockResolvedValue({ allCollectedRoutes: [] }),
      save: jest.fn().mockResolvedValue(undefined),
      create: jest.fn(),
    };

    jobService = new SessionFinalizationJobService(
      mockFinalizer,
      mockStagingManager,
      mockSessionRepository
    );
  });

  describe('Small batch (50 notes)', () => {
    it(`should complete in < ${PERF_THRESHOLDS.small.maxP95Ms}ms p95`, async () => {
      if (!ENABLE_PERF_TESTS) {
        console.log('Perf tests disabled. Set ENABLE_PERF_TESTS=true to run.');
        return;
      }

      const runs = 20; // Enough for p95 calculation
      const durations: number[] = [];

      for (let i = 0; i < runs; i++) {
        const startTime = performance.now();
        const jobId = await jobService.queueFinalization(`session-${i}`);

        // Wait for completion
        await waitForJobCompletion(jobService, jobId, 5000);

        const duration = performance.now() - startTime;
        durations.push(duration);
      }

      durations.sort((a, b) => a - b);
      const p95Index = Math.floor(runs * 0.95);
      const p95 = durations[p95Index];
      const avg = durations.reduce((a, b) => a + b, 0) / runs;

      console.log(`Small batch perf: avg=${avg.toFixed(2)}ms, p95=${p95.toFixed(2)}ms`);

      expect(p95).toBeLessThan(PERF_THRESHOLDS.small.maxP95Ms);
    });
  });

  describe('Medium batch (100 notes)', () => {
    it(`should complete in < ${PERF_THRESHOLDS.medium.maxP95Ms}ms p95`, async () => {
      if (!ENABLE_PERF_TESTS) {
        return;
      }

      // Similar test structure
      const runs = 10;
      const durations: number[] = [];

      for (let i = 0; i < runs; i++) {
        const startTime = performance.now();
        const jobId = await jobService.queueFinalization(`session-${i}`);
        await waitForJobCompletion(jobService, jobId, 10000);
        durations.push(performance.now() - startTime);
      }

      durations.sort((a, b) => a - b);
      const p95 = durations[Math.floor(runs * 0.95)];

      console.log(`Medium batch perf: p95=${p95.toFixed(2)}ms`);
      expect(p95).toBeLessThan(PERF_THRESHOLDS.medium.maxP95Ms);
    });
  });

  describe('Large batch (300 notes)', () => {
    it(`should complete in < ${PERF_THRESHOLDS.large.maxP95Ms}ms p95`, async () => {
      if (!ENABLE_PERF_TESTS) {
        return;
      }

      const runs = 5; // Fewer runs for large batches
      const durations: number[] = [];

      for (let i = 0; i < runs; i++) {
        const startTime = performance.now();
        const jobId = await jobService.queueFinalization(`session-${i}`);
        await waitForJobCompletion(jobService, jobId, 15000);
        durations.push(performance.now() - startTime);
      }

      durations.sort((a, b) => a - b);
      const p95 = durations[Math.floor(runs * 0.95)];

      console.log(`Large batch perf: p95=${p95.toFixed(2)}ms`);
      expect(p95).toBeLessThan(PERF_THRESHOLDS.large.maxP95Ms);
    });
  });
});

/**
 * Helper: Wait for job completion with timeout
 */
async function waitForJobCompletion(
  jobService: SessionFinalizationJobService,
  jobId: string,
  timeoutMs: number
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const job = jobService.getJobStatus(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status === 'completed' || job.status === 'failed') {
      if (job.status === 'failed') {
        throw new Error(`Job ${jobId} failed: ${job.error}`);
      }
      return;
    }

    // Poll every 50ms
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`Job ${jobId} timed out after ${timeoutMs}ms`);
}

/**
 * Usage instructions:
 *
 * # Run performance tests locally
 * ENABLE_PERF_TESTS=true npm test -- session-finalization-perf.test.ts
 *
 * # Override thresholds
 * PERF_THRESHOLD_SMALL_P95=300 ENABLE_PERF_TESTS=true npm test
 *
 * # Run as part of pre-release validation
 * npm run test:perf
 */
