import type { LoggerPort } from '@core-domain';

import { PerformanceMonitoringMiddleware } from '../performance-monitoring.middleware';

interface MockResponse {
  statusCode: number;
  send: jest.Mock;
  json: jest.Mock;
  on: jest.Mock;
}

describe('PerformanceMonitoringMiddleware', () => {
  const createLogger = (): jest.Mocked<LoggerPort> =>
    ({
      child: jest.fn().mockReturnThis(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }) as unknown as jest.Mocked<LoggerPort>;

  const createResponse = (): {
    res: MockResponse;
    listeners: Record<string, () => void>;
  } => {
    const listeners: Record<string, () => void> = {};
    const res: MockResponse = {
      statusCode: 200,
      send: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      on: jest.fn((event: string, callback: () => void): MockResponse => {
        listeners[event] = callback;
        return res;
      }),
    };

    return { res, listeners };
  };

  it('logs correlated publication requests with uploadRunId, sessionId, jobId, and phase', () => {
    const logger = createLogger();
    const middleware = new PerformanceMonitoringMiddleware(logger);
    const { res, listeners } = createResponse();
    const req = {
      method: 'GET',
      originalUrl:
        '/events/session/session-123/finalization?jobId=job-456&token=signed-token&view=live',
      headers: {
        'x-upload-run-id': 'run-123',
      },
      body: {},
      params: { sessionId: 'session-123' },
      query: { jobId: 'job-456', token: 'signed-token', view: 'live' },
      route: { path: '/events/session/:sessionId/finalization' },
    } as any;
    const next = jest.fn();

    middleware.handle()(req, res as any, next);
    listeners.finish();

    expect(next).toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      '[PERF] Request completed',
      expect.objectContaining({
        uploadRunId: 'run-123',
        sessionId: 'session-123',
        jobId: 'job-456',
        phase: 'finalization_events',
        url: '/events/session/session-123/finalization?jobId=job-456&token=%5Bredacted%5D&view=live',
      })
    );
    expect(logger.debug).not.toHaveBeenCalledWith(
      '[PERF] Request completed',
      expect.objectContaining({
        url: expect.stringContaining('signed-token'),
      })
    );

    middleware.stopEventLoopMonitoring();
  });
});
