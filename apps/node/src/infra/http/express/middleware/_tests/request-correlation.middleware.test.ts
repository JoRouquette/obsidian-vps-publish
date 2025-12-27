import { RequestCorrelationMiddleware } from '../request-correlation.middleware';

describe('RequestCorrelationMiddleware', () => {
  let middleware: RequestCorrelationMiddleware;
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    middleware = new RequestCorrelationMiddleware();
    mockReq = {
      headers: {},
      method: 'GET',
      path: '/api/test',
      ip: '127.0.0.1',
    };
    mockRes = {
      setHeader: jest.fn(),
      on: jest.fn(),
    };
    mockNext = jest.fn();
  });

  describe('request ID generation', () => {
    it('should generate UUID when no x-request-id header present', () => {
      const handler = middleware.handle();
      handler(mockReq, mockRes, mockNext);

      expect(mockReq.requestId).toBeDefined();
      expect(mockReq.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('x-request-id', mockReq.requestId);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use existing x-request-id from header', () => {
      const existingId = 'client-request-123';
      mockReq.headers['x-request-id'] = existingId;

      const handler = middleware.handle();
      handler(mockReq, mockRes, mockNext);

      expect(mockReq.requestId).toBe(existingId);
      expect(mockRes.setHeader).toHaveBeenCalledWith('x-request-id', existingId);
    });

    it('should support x-correlation-id as fallback', () => {
      const correlationId = 'correlation-456';
      mockReq.headers['x-correlation-id'] = correlationId;

      const handler = middleware.handle();
      handler(mockReq, mockRes, mockNext);

      expect(mockReq.requestId).toBe(correlationId);
    });

    it('should support x-trace-id as fallback', () => {
      const traceId = 'trace-789';
      mockReq.headers['x-trace-id'] = traceId;

      const handler = middleware.handle();
      handler(mockReq, mockRes, mockNext);

      expect(mockReq.requestId).toBe(traceId);
    });

    it('should prioritize x-request-id over other headers', () => {
      mockReq.headers['x-request-id'] = 'request-id';
      mockReq.headers['x-correlation-id'] = 'correlation-id';
      mockReq.headers['x-trace-id'] = 'trace-id';

      const handler = middleware.handle();
      handler(mockReq, mockRes, mockNext);

      expect(mockReq.requestId).toBe('request-id');
    });
  });

  describe('response tracking', () => {
    it('should register finish event listener', () => {
      const handler = middleware.handle();
      handler(mockReq, mockRes, mockNext);

      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });
  });

  describe('static getRequestId', () => {
    it('should extract request ID from request', () => {
      mockReq.requestId = 'test-request-id';
      const id = RequestCorrelationMiddleware.getRequestId(mockReq);
      expect(id).toBe('test-request-id');
    });

    it('should return "unknown" if no request ID attached', () => {
      const id = RequestCorrelationMiddleware.getRequestId(mockReq);
      expect(id).toBe('unknown');
    });
  });
});
