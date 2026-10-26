import { type LoggerPort, LogLevel } from '@core-domain';

import { createApiKeyAuthMiddleware } from '../api-key-auth.middleware';

/**
 * The middleware takes a full `LoggerPort`, which carries `level` and `child`
 * on top of the four log methods. Stubbing only the methods does not type-check,
 * so the stub implements the whole port; `child` returns the stub itself, which
 * keeps every assertion on the same set of mocks.
 */
type LoggerStub = LoggerPort & {
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
};

const createLoggerStub = (): LoggerStub => {
  const stub: LoggerStub = {
    level: LogLevel.debug,
    child: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  (stub.child as jest.Mock).mockReturnValue(stub);
  return stub;
};

describe('createApiKeyAuthMiddleware', () => {
  const expectedKey = 'super-secret-api-key-value';

  let mockReq: any;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let mockRes: any;
  let mockNext: jest.Mock;
  let logger: LoggerStub;

  const givenApiKeyHeader = (value: string | undefined) => {
    mockReq.get = jest.fn((name: string) => (name === 'x-api-key' ? value : undefined));
  };

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn(() => ({ json: jsonMock }));
    mockReq = {
      method: 'POST',
      path: '/api/sessions',
      headers: { 'x-request-id': 'req-1' },
      get: jest.fn(() => undefined),
    };
    mockRes = { status: statusMock };
    mockNext = jest.fn();
    logger = createLoggerStub();
  });

  it('responds 500 when the server API key is not configured', () => {
    givenApiKeyHeader(expectedKey);
    const handler = createApiKeyAuthMiddleware('', logger);

    handler(mockReq, mockRes, mockNext);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ ok: false, error: 'server misconfigured (API_KEY)' });
    expect(mockNext).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('responds 401 when the request has no API key', () => {
    givenApiKeyHeader(undefined);
    const handler = createApiKeyAuthMiddleware(expectedKey, logger);

    handler(mockReq, mockRes, mockNext);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({ ok: false, error: 'missing api key' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('responds 403 when the API key is invalid', () => {
    givenApiKeyHeader('wrong-key');
    const handler = createApiKeyAuthMiddleware(expectedKey, logger);

    handler(mockReq, mockRes, mockNext);

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith({ ok: false, error: 'Invalid API key' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('responds 403 when a wrong API key has the same length as the expected one', () => {
    const sameLengthKey = 'x'.repeat(expectedKey.length);
    givenApiKeyHeader(sameLengthKey);
    const handler = createApiKeyAuthMiddleware(expectedKey, logger);

    handler(mockReq, mockRes, mockNext);

    expect(sameLengthKey).toHaveLength(expectedKey.length);
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('calls next when the API key matches', () => {
    givenApiKeyHeader(expectedKey);
    const handler = createApiKeyAuthMiddleware(expectedKey, logger);

    handler(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(statusMock).not.toHaveBeenCalled();
  });

  it('normalizes surrounding whitespace and BOM before comparison', () => {
    givenApiKeyHeader(`\uFEFF  ${expectedKey}  `);
    const handler = createApiKeyAuthMiddleware(expectedKey, logger);

    handler(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(statusMock).not.toHaveBeenCalled();
  });

  it('never logs the expected API key (nor its hex) on any code path', () => {
    givenApiKeyHeader('wrong-key');
    const handler = createApiKeyAuthMiddleware(expectedKey, logger);

    handler(mockReq, mockRes, mockNext);

    const expectedHex = Buffer.from(expectedKey).toString('hex');
    const allLoggedArgs = [
      ...logger.debug.mock.calls,
      ...logger.info.mock.calls,
      ...logger.warn.mock.calls,
      ...logger.error.mock.calls,
    ]
      .flat()
      .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
      .join(' ');

    expect(allLoggedArgs).not.toContain(expectedKey);
    expect(allLoggedArgs).not.toContain(expectedHex);
  });
});
