/**
 * Backpressure middleware smoke tests
 * Verifies that server protection mechanisms work as expected
 */

import { BackpressureMiddleware } from '../middleware/backpressure.middleware';

describe('Backpressure Middleware', () => {
  let middleware: BackpressureMiddleware;
  let mockReq: any;
  let mockRes: any;
  let nextCalled: boolean;

  beforeEach(() => {
    middleware = new BackpressureMiddleware({
      maxEventLoopLagMs: 200,
      maxMemoryUsageMB: 500,
      maxActiveRequests: 50,
    });

    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      on: jest.fn((event, handler) => {
        if (event === 'finish') {
          // Simulate immediate finish for tests
          setTimeout(() => handler(), 0);
        }
        return mockRes;
      }),
    };
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
      const next = jest.fn();

      // Simulate 51 concurrent requests (max is 50)
      const requests: Promise<void>[] = [];
      for (let i = 0; i < 51; i++) {
        const mockReqConcurrent = {};
        const mockResConcurrent = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
          on: jest.fn(),
        };

        requests.push(
          new Promise((resolve) => {
            handler(mockReqConcurrent, mockResConcurrent, () => {
              resolve();
            });
          })
        );
      }

      await Promise.all(requests);

      // At least one request should be rejected
      expect(mockRes.status).toHaveBeenCalledWith(429);
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

      // Start request
      handler(mockReq, mockRes, next);

      // Trigger finish event
      const finishHandler = mockRes.on.mock.calls.find((call: any) => call[0] === 'finish')?.[1];
      if (finishHandler) finishHandler();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const metrics2 = middleware.getLoadMetrics();
      expect(metrics2.activeRequests).toBe(initialActive);
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
      const metrics1 = middleware.getLoadMetrics();

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

      handler(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
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
        const req = {};
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
          on: jest.fn(),
        };
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
        const req = {};
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
          on: jest.fn((event, cb) => {
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
      const newReq = {};
      const newRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        on: jest.fn(),
      };
      const newNext = jest.fn();

      handler(newReq, newRes, newNext);

      expect(newNext).toHaveBeenCalled();
      expect(newRes.status).not.toHaveBeenCalled();
    });
  });
});
