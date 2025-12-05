jest.mock('obsidian', () => ({ requestUrl: jest.fn() }), { virtual: true });

import { testVpsConnection } from '../lib/services/http-connection.service';

const mockLogger = () =>
  ({
    child: jest.fn().mockImplementation(() => mockLogger()),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as any;

describe('testVpsConnection', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('retourne une erreur si la clé API est absente', async () => {
    const handler = { handleResponseAsync: jest.fn() };
    const logger = mockLogger();
    const res = await testVpsConnection(
      {
        id: 'v',
        name: 'v',
        baseUrl: 'http://x',
        apiKey: '',
        ignoreRules: [],
        cleanupRules: [],
        folders: [],
      },
      handler as any,
      logger
    );
    expect(res.isError).toBe(true);
    expect(handler.handleResponseAsync).not.toHaveBeenCalled();
  });

  it('retourne une erreur si l’URL est absente', async () => {
    const handler = { handleResponseAsync: jest.fn() };
    const logger = mockLogger();
    const res = await testVpsConnection(
      {
        id: 'v',
        name: 'v',
        baseUrl: '',
        apiKey: 'k',
        ignoreRules: [],
        cleanupRules: [],
        folders: [],
      },
      handler as any,
      logger
    );
    expect(res.isError).toBe(true);
  });

  it('appelle requestUrl et délègue au handler en cas de succès', async () => {
    const mockResponse = { status: 200, text: 'pong', headers: {} } as any;
    const { requestUrl } = jest.requireMock('obsidian') as { requestUrl: jest.Mock };
    requestUrl.mockResolvedValue(mockResponse);

    const handler = { handleResponseAsync: jest.fn().mockResolvedValue({ isError: false }) };
    const logger = mockLogger();

    const res = await testVpsConnection(
      {
        id: 'v',
        name: 'v',
        baseUrl: 'http://example.com/',
        apiKey: 'k',
        ignoreRules: [],
        cleanupRules: [],
        folders: [],
      },
      handler as any,
      logger
    );

    expect(requestUrl).toHaveBeenCalledWith({
      url: 'http://example.com/api/ping',
      method: 'GET',
      headers: { 'x-api-key': 'k' },
      throw: false,
    });
    expect(handler.handleResponseAsync).toHaveBeenCalledWith({
      response: mockResponse,
      url: 'http://example.com/api/ping',
    });
    expect(res.isError).toBe(false);
  });

  it('renvoie isError si requestUrl lève', async () => {
    const { requestUrl } = jest.requireMock('obsidian') as { requestUrl: jest.Mock };
    requestUrl.mockRejectedValue(new Error('boom'));

    const handler = { handleResponseAsync: jest.fn() };
    const logger = mockLogger();
    const res = await testVpsConnection(
      {
        id: 'v',
        name: 'v',
        baseUrl: 'http://example.com',
        apiKey: 'k',
        ignoreRules: [],
        cleanupRules: [],
        folders: [],
      },
      handler as any,
      logger
    );

    expect(res.isError).toBe(true);
    expect(handler.handleResponseAsync).not.toHaveBeenCalled();
  });
});
