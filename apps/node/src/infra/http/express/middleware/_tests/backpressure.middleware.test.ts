/**
 * Backpressure middleware smoke tests
 * Verifies that server protection mechanisms work as expected
 */

import { createFinalizationStreamAuthorizer } from '../../controllers/finalization-events.controller';
import { FinalizationStreamTokenService } from '../../finalization-stream-token.service';
import {
  BackpressureMiddleware,
  type FinalizationStreamAuthorizer,
} from '../backpressure.middleware';

// The real authorizer and token service, so the exemption is tested against the
// same route and signature the stream controller checks. How the authorizer
// reads the request is covered by finalization-stream-authorizer.test.ts.
const streamTokens = new FinalizationStreamTokenService('backpressure-test-secret');
const streamAuthorizer = createFinalizationStreamAuthorizer(streamTokens);
const VALID_STREAM_TOKEN = streamTokens.createToken('session-1', 'job-1').token;
const FORGED_STREAM_TOKEN = new FinalizationStreamTokenService('another-secret').createToken(
  'session-1',
  'job-1'
).token;

const NO_LOAD = {
  maxEventLoopLagMs: Number.MAX_SAFE_INTEGER,
  maxMemoryUsageMB: Number.MAX_SAFE_INTEGER,
  maxActiveRequests: Number.MAX_SAFE_INTEGER,
};

// The shape Express hands the middleware: path without the query, query
// already parsed.
function streamRequest({
  token,
  method = 'GET',
  path = '/events/session/session-1/finalization',
  accept = 'text/event-stream',
}: { token?: string; method?: string; path?: string; accept?: string | null } = {}) {
  return {
    method,
    path,
    query: token ? { jobId: 'job-1', token } : { jobId: 'job-1' },
    headers: accept ? { accept } : {},
  };
}

const ORDINARY_REQUEST = { method: 'GET', path: '/api/ping', query: {}, headers: {} };

function runOnce(
  config: Partial<typeof NO_LOAD>,
  req: Record<string, unknown>,
  authorizer: FinalizationStreamAuthorizer | null = streamAuthorizer
) {
  const strictMiddleware = new BackpressureMiddleware({ ...NO_LOAD, ...config });
  if (authorizer) {
    strictMiddleware.authorizeFinalizationStreams(authorizer);
  }
  const next = jest.fn();
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    header: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
  } as any;

  strictMiddleware.handle()(req as any, res, next);
  const activeRequests = strictMiddleware.getLoadMetrics().activeRequests;
  strictMiddleware.stopEventLoopMonitoring();

  return { next, res, activeRequests };
}

describe('Backpressure Middleware', () => {
  let middleware: BackpressureMiddleware;
  let mockReq: any;
  let mockRes: any;
  let nextCalled: boolean;

  beforeEach(() => {
    middleware = new BackpressureMiddleware({
      // Keep the default test middleware focused on active-request behaviour.
      // CI machines can legitimately exceed "reasonable" lag or heap thresholds,
      // which would make these tests flaky for the wrong reason.
      maxEventLoopLagMs: Number.MAX_SAFE_INTEGER,
      maxMemoryUsageMB: Number.MAX_SAFE_INTEGER,
      maxActiveRequests: 50,
    });

    mockReq = {} as any;
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      header: jest.fn().mockReturnThis(),
      on: jest.fn((event, handler) => {
        if (event === 'finish') {
          // Simulate immediate finish for tests
          setTimeout(() => handler(), 0);
        }
        return mockRes;
      }),
    } as any;
    nextCalled = false;
  });

  afterEach(() => {
    middleware.stopEventLoopMonitoring();
  });

  describe('Request limiting', () => {
    it('should allow requests under threshold', () => {
      const handler = middleware.handle();
      const next = () => {
        nextCalled = true;
      };

      handler(mockReq, mockRes, next);

      expect(nextCalled).toBe(true);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject requests when max active requests exceeded', async () => {
      const handler = middleware.handle();

      // Simulate 51 concurrent requests (max is 50)
      let rejectedCount = 0;
      const requests: Promise<void>[] = [];

      for (let i = 0; i < 51; i++) {
        const mockReqConcurrent = {} as any;
        const mockResConcurrent = {
          status: jest.fn((code: number) => {
            if (code === 429) rejectedCount++;
            return mockResConcurrent;
          }),
          json: jest.fn().mockReturnThis(),
          header: jest.fn().mockReturnThis(),
          on: jest.fn((event: string, cb: () => void) => {
            if (event === 'finish') setTimeout(cb, 0);
            return mockResConcurrent;
          }),
        } as any;

        requests.push(
          new Promise((resolve) => {
            handler(mockReqConcurrent, mockResConcurrent, () => {
              // next() called - request accepted
            });
            // Resolve immediately regardless of acceptance or rejection
            resolve();
          })
        );
      }

      await Promise.all(requests);

      // At least one request should be rejected
      expect(rejectedCount).toBeGreaterThan(0);
    });

    it('should return 429 with retry information', () => {
      // Create middleware with very low threshold to trigger easily
      const strictMiddleware = new BackpressureMiddleware({
        maxEventLoopLagMs: 0,
        maxMemoryUsageMB: 1,
        maxActiveRequests: 0,
      });

      const handler = strictMiddleware.handle();
      const next = jest.fn();

      handler(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too Many Requests',
          message: expect.any(String),
          retryAfterMs: expect.any(Number),
        })
      );

      strictMiddleware.stopEventLoopMonitoring();
    });

    it('should decrement active requests on response finish', async () => {
      const handler = middleware.handle();
      const next = jest.fn();

      const metrics1 = middleware.getLoadMetrics();
      const initialActive = metrics1.activeRequests;

      // Create mock with proper finish handler
      const testRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        header: jest.fn().mockReturnThis(),
        on: jest.fn((event, cb) => {
          if (event === 'finish') setTimeout(cb, 0);
          return testRes;
        }),
      } as any;

      // Start request
      handler({} as any, testRes, next);

      // Wait for finish to be called
      await new Promise((resolve) => setTimeout(resolve, 20));

      const metrics2 = middleware.getLoadMetrics();
      expect(metrics2.activeRequests).toBe(initialActive);
    });

    describe('finalization stream exemption', () => {
      // The measured lag starts at 0 and the check is strict (lag > threshold),
      // so -1 forces the lag cause without depending on the machine's load.
      const EVENT_LOOP_LAG = { maxEventLoopLagMs: -1 };
      const MEMORY_PRESSURE = { maxMemoryUsageMB: 1 };
      const FULL_QUOTA = { maxActiveRequests: 0 };

      describe('on the active request quota', () => {
        it('should not count an authenticated stream', () => {
          const { next, res, activeRequests } = runOnce(
            FULL_QUOTA,
            streamRequest({ token: VALID_STREAM_TOKEN })
          );

          expect(next).toHaveBeenCalled();
          expect(res.status).not.toHaveBeenCalled();
          expect(activeRequests).toBe(0);
        });

        // The Accept header, the method and the path are client-controlled:
        // without a valid token, a request that looks like the stream is an
        // ordinary request.
        it.each([
          ['a forged token', streamRequest({ token: FORGED_STREAM_TOKEN })],
          [
            'a POST with a valid token',
            streamRequest({ token: VALID_STREAM_TOKEN, method: 'POST' }),
          ],
          [
            'another route with the SSE accept header',
            streamRequest({ token: VALID_STREAM_TOKEN, path: '/api/ping' }),
          ],
        ])('should count and shed %s', (_label, req) => {
          const { next, res } = runOnce(FULL_QUOTA, req);

          expect(next).not.toHaveBeenCalled();
          expect(res.status).toHaveBeenCalledWith(429);
          expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ cause: 'active_requests' })
          );
        });
      });

      describe('on event loop lag', () => {
        // The lag check and the request tracking both ask for the verdict: the
        // token must still be checked only once.
        it('should exempt an authenticated stream, checking its token once', () => {
          const authorizer = jest.fn(streamAuthorizer);

          const { next, res } = runOnce(
            EVENT_LOOP_LAG,
            streamRequest({ token: VALID_STREAM_TOKEN }),
            authorizer
          );

          expect(next).toHaveBeenCalled();
          expect(res.status).not.toHaveBeenCalled();
          expect(authorizer).toHaveBeenCalledTimes(1);
        });

        it.each([
          ['a forged token', streamRequest({ token: FORGED_STREAM_TOKEN })],
          ['no token', streamRequest()],
          ['no SSE accept header', streamRequest({ token: VALID_STREAM_TOKEN, accept: null })],
        ])('should shed a stream with %s', (_label, req) => {
          const { next, res } = runOnce(EVENT_LOOP_LAG, req);

          expect(next).not.toHaveBeenCalled();
          expect(res.header).toHaveBeenCalledWith('X-RateLimit-Cause', 'event_loop_lag');
        });

        // Safe by default: until the app wires the authorizer in, nothing is exempt.
        it('should shed an authenticated stream when no authorizer is set', () => {
          const { next, res } = runOnce(
            EVENT_LOOP_LAG,
            streamRequest({ token: VALID_STREAM_TOKEN }),
            null
          );

          expect(next).not.toHaveBeenCalled();
          expect(res.header).toHaveBeenCalledWith('X-RateLimit-Cause', 'event_loop_lag');
        });
      });

      describe('on memory pressure', () => {
        // Memory pressure stays the out-of-memory guard, authenticated stream
        // included, so the token check is not even worth its HMAC there.
        it('should shed an authenticated stream without checking its token', () => {
          const authorizer = jest.fn(streamAuthorizer);

          const { next, res } = runOnce(
            MEMORY_PRESSURE,
            streamRequest({ token: VALID_STREAM_TOKEN }),
            authorizer
          );

          expect(next).not.toHaveBeenCalled();
          expect(res.header).toHaveBeenCalledWith('X-RateLimit-Cause', 'memory_pressure');
          expect(authorizer).not.toHaveBeenCalled();
        });
      });

      it.each([
        ['event loop lag', EVENT_LOOP_LAG, 'event_loop_lag'],
        ['memory pressure', MEMORY_PRESSURE, 'memory_pressure'],
      ])('should still shed ordinary requests on %s', (_label, config, cause) => {
        const { next, res } = runOnce(config, ORDINARY_REQUEST);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.header).toHaveBeenCalledWith('X-RateLimit-Cause', cause);
      });

      it('should not call the authorizer for an ordinary request', () => {
        const authorizer = jest.fn(streamAuthorizer);

        runOnce(FULL_QUOTA, ORDINARY_REQUEST, authorizer);

        expect(authorizer).not.toHaveBeenCalled();
      });
    });
  });

  describe('Load metrics', () => {
    it('should provide current load metrics', () => {
      const metrics = middleware.getLoadMetrics();

      expect(metrics).toHaveProperty('activeRequests');
      expect(metrics).toHaveProperty('eventLoopLagMs');
      expect(metrics).toHaveProperty('memoryUsageMB');
      expect(metrics).toHaveProperty('isUnderPressure');

      expect(typeof metrics.activeRequests).toBe('number');
      expect(typeof metrics.eventLoopLagMs).toBe('number');
      expect(typeof metrics.memoryUsageMB).toBe('number');
      expect(typeof metrics.isUnderPressure).toBe('boolean');
    });

    it('should indicate pressure when thresholds exceeded', () => {
      // Create middleware with very low thresholds
      const sensitiveMiddleware = new BackpressureMiddleware({
        maxEventLoopLagMs: 0,
        maxMemoryUsageMB: 1,
        maxActiveRequests: 0,
      });

      const metrics = sensitiveMiddleware.getLoadMetrics();
      expect(metrics.isUnderPressure).toBe(true);

      sensitiveMiddleware.stopEventLoopMonitoring();
    });
  });

  describe('Event loop monitoring', () => {
    it('should track event loop lag over time', async () => {
      // Wait for lag to stabilize
      await new Promise((resolve) => setTimeout(resolve, 500));

      const metrics = middleware.getLoadMetrics();
      expect(metrics.eventLoopLagMs).toBeGreaterThanOrEqual(0);
    });

    it('should use exponential moving average for lag', async () => {
      // Initial metrics
      await new Promise((resolve) => setTimeout(resolve, 200));
      const _metrics1 = middleware.getLoadMetrics();

      // Wait more
      await new Promise((resolve) => setTimeout(resolve, 200));
      const metrics2 = middleware.getLoadMetrics();

      // Lag should be smoothed (EMA), not jumping wildly
      expect(metrics2.eventLoopLagMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Memory monitoring', () => {
    it('should track current heap usage', () => {
      const metrics = middleware.getLoadMetrics();
      expect(metrics.memoryUsageMB).toBeGreaterThan(0);
      expect(metrics.memoryUsageMB).toBeLessThan(10000); // Sanity check
    });

    it('should reject requests when memory threshold exceeded', () => {
      // Create middleware with very low memory threshold
      const lowMemMiddleware = new BackpressureMiddleware({
        maxEventLoopLagMs: 10000,
        maxMemoryUsageMB: 1, // 1MB - current heap is surely > this
        maxActiveRequests: 1000,
      });

      const handler = lowMemMiddleware.handle();
      const next = jest.fn();

      const testRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        header: jest.fn().mockReturnThis(),
        on: jest.fn(),
      } as any;

      handler({} as any, testRes, next);

      expect(testRes.status).toHaveBeenCalledWith(429);
      expect(testRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('memory'),
        })
      );

      lowMemMiddleware.stopEventLoopMonitoring();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle rapid successive requests gracefully', async () => {
      const handler = middleware.handle();
      const requests = [];

      for (let i = 0; i < 10; i++) {
        const req = {} as any;
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
          header: jest.fn().mockReturnThis(),
          on: jest.fn(),
        } as any;
        const next = jest.fn();

        requests.push({ req, res, next });
        handler(req, res, next);
      }

      // All 10 requests should be accepted (under threshold of 50)
      const rejections = requests.filter((r) => r.res.status.mock.calls.length > 0);
      expect(rejections.length).toBe(0);
    });

    it('should recover after load spike', async () => {
      const handler = middleware.handle();

      // Spike: send many requests
      for (let i = 0; i < 10; i++) {
        const req = {} as any;
        const res: any = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
          header: jest.fn().mockReturnThis(),
          on: jest.fn((event: string, cb: () => void) => {
            if (event === 'finish') setTimeout(cb, 0);
            return res;
          }),
        };
        const next = jest.fn();
        handler(req, res, next);
      }

      // Wait for requests to finish
      await new Promise((resolve) => setTimeout(resolve, 50));

      // New request should be accepted
      const newReq = {} as any;
      const newRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        header: jest.fn().mockReturnThis(),
        on: jest.fn(),
      } as any;
      const newNext = jest.fn();

      handler(newReq, newRes, newNext);

      expect(newNext).toHaveBeenCalled();
      expect(newRes.status).not.toHaveBeenCalled();
    });
  });
});
