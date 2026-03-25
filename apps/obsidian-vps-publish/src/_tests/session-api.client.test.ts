const mockLogger = () =>
  ({
    child: jest.fn().mockReturnThis(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as any;

const responseOk = (text: string) => ({
  isError: false,
  text,
});

describe('SessionApiClient', () => {
  afterEach(() => {
    jest.resetModules();
    jest.resetAllMocks();
  });

  it('uses the strictest request size limit between client and server', async () => {
    const requestUrl = jest.fn().mockResolvedValue({
      status: 200,
      headers: {},
      text: JSON.stringify({ sessionId: 's1', maxBytesPerRequest: '1mb' }),
    });
    const handler = {
      handleResponseAsync: jest
        .fn()
        .mockResolvedValue(responseOk('{"sessionId":"s1","maxBytesPerRequest":"1mb"}')),
    };
    jest.doMock('obsidian', () => ({ requestUrl }));

    const { SessionApiClient: Client } = await import('../lib/services/session-api.client');
    const client = new Client('http://api', 'k', handler as any, mockLogger());
    const res = await client.startSession({
      notesPlanned: 1,
      assetsPlanned: 0,
      maxBytesPerRequest: 1024,
    });

    expect(res.sessionId).toBe('s1');
    expect(res.maxBytesPerRequest).toBe(1024);
  });

  it('accepts a smaller server limit than the plugin requested', async () => {
    const requestUrl = jest.fn().mockResolvedValue({
      status: 200,
      headers: {},
      text: JSON.stringify({ sessionId: 's1', maxBytesPerRequest: 512 }),
    });
    const handler = {
      handleResponseAsync: jest
        .fn()
        .mockResolvedValue(responseOk('{"sessionId":"s1","maxBytesPerRequest":512}')),
    };
    jest.doMock('obsidian', () => ({ requestUrl }));

    const { SessionApiClient: Client } = await import('../lib/services/session-api.client');
    const client = new Client('http://api', 'k', handler as any, mockLogger());
    const res = await client.startSession({
      notesPlanned: 1,
      assetsPlanned: 0,
      maxBytesPerRequest: 1024,
    });

    expect(res.maxBytesPerRequest).toBe(512);
  });

  it('passes the deduplication flag when starting a session', async () => {
    const requestUrl = jest.fn().mockResolvedValue({
      status: 200,
      headers: {},
      text: JSON.stringify({ sessionId: 's1', maxBytesPerRequest: 1024 }),
    });
    const handler = {
      handleResponseAsync: jest
        .fn()
        .mockResolvedValue(responseOk('{"sessionId":"s1","maxBytesPerRequest":1024}')),
    };
    jest.doMock('obsidian', () => ({ requestUrl }));

    const { SessionApiClient: Client } = await import('../lib/services/session-api.client');
    const client = new Client('http://api', 'k', handler as any, mockLogger());
    await client.startSession({
      notesPlanned: 1,
      assetsPlanned: 0,
      maxBytesPerRequest: 1024,
      deduplicationEnabled: false,
    });

    expect(requestUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('"deduplicationEnabled":false'),
      })
    );
  });

  it('throws when uploadNotes fails', async () => {
    const requestUrl = jest.fn().mockResolvedValue({ status: 500, headers: {}, text: 'err' });
    const handler = {
      handleResponseAsync: jest.fn().mockResolvedValue({ isError: true, error: new Error('fail') }),
    };
    jest.doMock('obsidian', () => ({ requestUrl }));

    const { SessionApiClient: Client } = await import('../lib/services/session-api.client');
    const client = new Client('http://api', 'k', handler as any, mockLogger());

    await expect(client.uploadNotes('s1', [])).rejects.toThrow('fail');
  });

  it('uses the correct abortSession endpoint', async () => {
    const requestUrl = jest.fn().mockResolvedValue({ status: 200, headers: {}, text: '{}' });
    const handler = {
      handleResponseAsync: jest.fn().mockResolvedValue({ isError: false, text: '{}' }),
    };
    jest.doMock('obsidian', () => ({ requestUrl }));

    const { SessionApiClient: Client } = await import('../lib/services/session-api.client');
    const client = new Client('http://api', 'k', handler as any, mockLogger());
    await client.abortSession('s42');

    expect(requestUrl).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'http://api/api/session/s42/abort', method: 'POST' })
    );
  });

  it('polls finalization status until completion after finish is accepted', async () => {
    const requestUrl = jest
      .fn()
      .mockResolvedValueOnce({
        status: 202,
        headers: {},
        text: JSON.stringify({ sessionId: 's1', jobId: 'job-1', status: 'queued' }),
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: {},
        text: JSON.stringify({
          jobId: 'job-1',
          sessionId: 's1',
          status: 'processing',
          progress: 50,
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: {},
        text: JSON.stringify({
          jobId: 'job-1',
          sessionId: 's1',
          status: 'completed',
          progress: 100,
          result: {
            promotionStats: {
              notesPublished: 1,
              notesDeduplicated: 0,
              notesDeleted: 0,
              assetsPublished: 0,
              assetsDeduplicated: 0,
            },
          },
        }),
      });
    const handler = {
      handleResponseAsync: jest
        .fn()
        .mockResolvedValueOnce({
          isError: false,
          text: '{"sessionId":"s1","jobId":"job-1","status":"queued"}',
        })
        .mockResolvedValueOnce({
          isError: false,
          text: '{"jobId":"job-1","sessionId":"s1","status":"processing","progress":50}',
        })
        .mockResolvedValueOnce({
          isError: false,
          text: '{"jobId":"job-1","sessionId":"s1","status":"completed","progress":100,"result":{"promotionStats":{"notesPublished":1,"notesDeduplicated":0,"notesDeleted":0,"assetsPublished":0,"assetsDeduplicated":0}}}',
        }),
    };
    jest.doMock('obsidian', () => ({ requestUrl }));

    const { SessionApiClient: Client } = await import('../lib/services/session-api.client');
    const client = new Client('http://api', 'k', handler as any, mockLogger());
    const result = await client.finishSession('s1', {
      notesProcessed: 1,
      assetsProcessed: 0,
    });

    expect(result.promotionStats?.notesPublished).toBe(1);
    expect(requestUrl).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ url: 'http://api/api/session/s1/status', method: 'GET' })
    );
  });
});
