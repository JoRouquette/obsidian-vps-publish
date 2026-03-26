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

type MockEventSourceListener = (event?: { data?: string }) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];

  static reset(): void {
    MockEventSource.instances = [];
  }

  readonly addEventListener = jest.fn((type: string, listener: MockEventSourceListener) => {
    const listeners = this.listeners.get(type) ?? new Set<MockEventSourceListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  });

  readonly removeEventListener = jest.fn((type: string, listener: MockEventSourceListener) => {
    this.listeners.get(type)?.delete(listener);
  });

  readonly close = jest.fn(() => {
    this.closed = true;
  });

  private readonly listeners = new Map<string, Set<MockEventSourceListener>>();
  private closed = false;

  constructor(readonly url: string) {
    MockEventSource.instances.push(this);
  }

  emit(type: string, event?: { data?: string }): void {
    if (this.closed) {
      return;
    }

    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  emitJson(type: string, payload: unknown): void {
    this.emit(type, { data: JSON.stringify(payload) });
  }
}

const originalEventSource = (globalThis as { EventSource?: unknown }).EventSource;

function installMockEventSource(): typeof MockEventSource {
  (globalThis as { EventSource?: unknown }).EventSource = MockEventSource as unknown;
  return MockEventSource;
}

function restoreEventSource(): void {
  if (originalEventSource === undefined) {
    delete (globalThis as { EventSource?: unknown }).EventSource;
    return;
  }

  (globalThis as { EventSource?: unknown }).EventSource = originalEventSource;
}

async function getCreatedEventSource(): Promise<MockEventSource> {
  for (let attempt = 0; attempt < 20; attempt++) {
    await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));

    const eventSource = MockEventSource.instances[0];
    if (eventSource) {
      return eventSource;
    }
  }

  throw new Error('Expected EventSource instance to be created');
}

async function getCreatedEventSourceWithFakeTimers(): Promise<MockEventSource> {
  for (let attempt = 0; attempt < 20; attempt++) {
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(0);

    const eventSource = MockEventSource.instances[0];
    if (eventSource) {
      return eventSource;
    }
  }

  throw new Error('Expected EventSource instance to be created');
}

describe('SessionApiClient', () => {
  afterEach(() => {
    restoreEventSource();
    MockEventSource.reset();
    jest.useRealTimers();
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
    const client = new Client('http://api', 'very-secret-api-key', handler as any, mockLogger());
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

  it('parses authoritative source note hashes keyed by vaultPath', async () => {
    const requestUrl = jest.fn().mockResolvedValue({
      status: 200,
      headers: {},
      text: JSON.stringify({
        sessionId: 's1',
        maxBytesPerRequest: 1024,
        existingSourceNoteHashesByVaultPath: {
          'notes/a.md': 'hash-a',
        },
      }),
    });
    const handler = {
      handleResponseAsync: jest
        .fn()
        .mockResolvedValue(
          responseOk(
            '{"sessionId":"s1","maxBytesPerRequest":1024,"existingSourceNoteHashesByVaultPath":{"notes/a.md":"hash-a"}}'
          )
        ),
    };
    jest.doMock('obsidian', () => ({ requestUrl }));

    const { SessionApiClient: Client } = await import('../lib/services/session-api.client');
    const client = new Client('http://api', 'k', handler as any, mockLogger());
    const res = await client.startSession({
      notesPlanned: 1,
      assetsPlanned: 0,
      maxBytesPerRequest: 1024,
      apiOwnedDeterministicNoteTransformsEnabled: true,
    });

    expect(res.existingSourceNoteHashesByVaultPath).toEqual({
      'notes/a.md': 'hash-a',
    });
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

  it('passes the api-owned deterministic transforms flag and ignore rules when starting a session', async () => {
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
      apiOwnedDeterministicNoteTransformsEnabled: true,
      ignoreRules: [{ property: 'publish', ignoreIf: false } as any],
    });

    expect(requestUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('"apiOwnedDeterministicNoteTransformsEnabled":true'),
      })
    );
    expect(requestUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('"ignoreRules":[{"property":"publish","ignoreIf":false}]'),
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

  it('keeps polling finalization status when status requests are temporarily throttled', async () => {
    jest.useFakeTimers();

    const requestUrlWithRetry = jest
      .fn()
      .mockResolvedValueOnce({
        status: 202,
        headers: {},
        text: JSON.stringify({ sessionId: 's1', jobId: 'job-1', status: 'queued' }),
      })
      .mockRejectedValueOnce(new Error('Server under load after 0 retries (429)'))
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
              notesPublished: 2,
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
          text: '{"jobId":"job-1","sessionId":"s1","status":"completed","progress":100,"result":{"promotionStats":{"notesPublished":2,"notesDeduplicated":0,"notesDeleted":0,"assetsPublished":0,"assetsDeduplicated":0}}}',
        }),
    };

    jest.doMock('obsidian', () => ({ requestUrl: jest.fn() }));
    jest.doMock('../lib/utils/request-with-retry.util', () => ({
      requestUrlWithRetry,
    }));

    const { SessionApiClient: Client } = await import('../lib/services/session-api.client');
    const client = new Client('http://api', 'k', handler as any, mockLogger());

    const resultPromise = client.finishSession('s1', {
      notesProcessed: 1,
      assetsProcessed: 0,
    });

    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.promotionStats?.notesPublished).toBe(2);
    expect(requestUrlWithRetry).toHaveBeenCalledTimes(3);
  });

  it('uses SSE finalization events when realtime metadata is returned', async () => {
    installMockEventSource();

    const requestUrlWithRetry = jest.fn().mockResolvedValueOnce({
      status: 202,
      headers: {},
      text: JSON.stringify({
        sessionId: 's1',
        jobId: 'job-1',
        status: 'queued',
        realtime: {
          transport: 'sse',
          streamUrl: '/events/session/s1/finalization?jobId=job-1',
          token: 'signed-token',
          expiresAt: '2099-01-01T00:00:00.000Z',
        },
      }),
    });
    const handler = {
      handleResponseAsync: jest.fn().mockResolvedValueOnce({
        isError: false,
        text: JSON.stringify({
          sessionId: 's1',
          jobId: 'job-1',
          status: 'queued',
          realtime: {
            transport: 'sse',
            streamUrl: '/events/session/s1/finalization?jobId=job-1',
            token: 'signed-token',
            expiresAt: '2099-01-01T00:00:00.000Z',
          },
        }),
      }),
    };

    jest.doMock('obsidian', () => ({ requestUrl: jest.fn() }));
    jest.doMock('../lib/utils/request-with-retry.util', () => ({
      requestUrlWithRetry,
    }));

    const { SessionApiClient: Client } = await import('../lib/services/session-api.client');
    const client = new Client('http://api', 'k', handler as any, mockLogger());

    const resultPromise = client.finishSession('s1', {
      notesProcessed: 1,
      assetsProcessed: 0,
    });

    const eventSource = await getCreatedEventSource();
    expect(eventSource.url).toBe(
      'http://api/events/session/s1/finalization?jobId=job-1&token=signed-token'
    );
    expect(eventSource.url).not.toContain('x-api-key');
    expect(eventSource.url).not.toContain('very-secret-api-key');

    eventSource.emitJson('connected', {
      jobId: 'job-1',
      sessionId: 's1',
      status: 'pending',
      progress: 0,
    });
    eventSource.emitJson('status', {
      jobId: 'job-1',
      sessionId: 's1',
      status: 'processing',
      progress: 85,
    });
    eventSource.emit('heartbeat');
    eventSource.emitJson('completed', {
      jobId: 'job-1',
      sessionId: 's1',
      status: 'completed',
      progress: 100,
      result: {
        promotionStats: {
          notesPublished: 3,
          notesDeduplicated: 1,
          notesDeleted: 0,
          assetsPublished: 0,
          assetsDeduplicated: 0,
        },
      },
    });

    await expect(resultPromise).resolves.toEqual({
      promotionStats: {
        notesPublished: 3,
        notesDeduplicated: 1,
        notesDeleted: 0,
        assetsPublished: 0,
        assetsDeduplicated: 0,
      },
    });
    expect(requestUrlWithRetry).toHaveBeenCalledTimes(1);
    expect(eventSource.close).toHaveBeenCalledTimes(1);
  });

  it('forwards backend finalization phases from SSE updates', async () => {
    installMockEventSource();

    const requestUrlWithRetry = jest.fn().mockResolvedValueOnce({
      status: 202,
      headers: {},
      text: JSON.stringify({
        sessionId: 's1',
        jobId: 'job-1',
        status: 'queued',
        realtime: {
          transport: 'sse',
          streamUrl: '/events/session/s1/finalization?jobId=job-1',
          token: 'signed-token',
          expiresAt: '2099-01-01T00:00:00.000Z',
        },
      }),
    });
    const handler = {
      handleResponseAsync: jest
        .fn()
        .mockResolvedValueOnce(
          responseOk(
            '{"sessionId":"s1","jobId":"job-1","status":"queued","realtime":{"transport":"sse","streamUrl":"/events/session/s1/finalization?jobId=job-1","token":"signed-token","expiresAt":"2099-01-01T00:00:00.000Z"}}'
          )
        ),
    };
    const onFinalizationUpdate = jest.fn();

    jest.doMock('obsidian', () => ({ requestUrl: jest.fn() }));
    jest.doMock('../lib/utils/request-with-retry.util', () => ({
      requestUrlWithRetry,
    }));

    const { SessionApiClient: Client } = await import('../lib/services/session-api.client');
    const client = new Client('http://api', 'k', handler as any, mockLogger());

    const resultPromise = client.finishSession(
      's1',
      {
        notesProcessed: 1,
        assetsProcessed: 0,
      },
      { onFinalizationUpdate }
    );

    const eventSource = await getCreatedEventSource();
    eventSource.emitJson('connected', {
      jobId: 'job-1',
      sessionId: 's1',
      status: 'processing',
      progress: 20,
      phase: 'rebuilding_notes',
    });
    eventSource.emitJson('status', {
      jobId: 'job-1',
      sessionId: 's1',
      status: 'processing',
      progress: 45,
      phase: 'rendering_html',
    });
    eventSource.emitJson('completed', {
      jobId: 'job-1',
      sessionId: 's1',
      status: 'completed',
      progress: 100,
      phase: 'completed',
      result: {
        promotionStats: {
          notesPublished: 3,
          notesDeduplicated: 0,
          notesDeleted: 0,
          assetsPublished: 0,
          assetsDeduplicated: 0,
        },
      },
    });

    await expect(resultPromise).resolves.toEqual({
      promotionStats: {
        notesPublished: 3,
        notesDeduplicated: 0,
        notesDeleted: 0,
        assetsPublished: 0,
        assetsDeduplicated: 0,
      },
    });

    expect(onFinalizationUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ phase: 'queued', progress: 0 })
    );
    expect(onFinalizationUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ phase: 'rebuilding_notes', progress: 20 })
    );
    expect(onFinalizationUpdate).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ phase: 'rendering_html', progress: 45 })
    );
    expect(onFinalizationUpdate).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ phase: 'completed', progress: 100 })
    );
  });

  it('resolves the publish flow when SSE emits completed', async () => {
    installMockEventSource();

    const requestUrlWithRetry = jest.fn().mockResolvedValueOnce({
      status: 202,
      headers: {},
      text: JSON.stringify({
        sessionId: 's1',
        jobId: 'job-1',
        status: 'queued',
        realtime: {
          transport: 'sse',
          streamUrl: '/events/session/s1/finalization?jobId=job-1',
          token: 'signed-token',
          expiresAt: '2099-01-01T00:00:00.000Z',
        },
      }),
    });
    const handler = {
      handleResponseAsync: jest
        .fn()
        .mockResolvedValueOnce(
          responseOk(
            '{"sessionId":"s1","jobId":"job-1","status":"queued","realtime":{"transport":"sse","streamUrl":"/events/session/s1/finalization?jobId=job-1","token":"signed-token","expiresAt":"2099-01-01T00:00:00.000Z"}}'
          )
        ),
    };

    jest.doMock('obsidian', () => ({ requestUrl: jest.fn() }));
    jest.doMock('../lib/utils/request-with-retry.util', () => ({
      requestUrlWithRetry,
    }));

    const { SessionApiClient: Client } = await import('../lib/services/session-api.client');
    const client = new Client('http://api', 'k', handler as any, mockLogger());

    const resultPromise = client.finishSession('s1', {
      notesProcessed: 1,
      assetsProcessed: 0,
    });

    const eventSource = await getCreatedEventSource();
    eventSource.emitJson('completed', {
      jobId: 'job-1',
      sessionId: 's1',
      status: 'completed',
      progress: 100,
      result: {
        promotionStats: {
          notesPublished: 5,
          notesDeduplicated: 0,
          notesDeleted: 0,
          assetsPublished: 0,
          assetsDeduplicated: 0,
        },
      },
    });

    await expect(resultPromise).resolves.toEqual({
      promotionStats: {
        notesPublished: 5,
        notesDeduplicated: 0,
        notesDeleted: 0,
        assetsPublished: 0,
        assetsDeduplicated: 0,
      },
    });
  });

  it('rejects when SSE emits failed', async () => {
    installMockEventSource();

    const requestUrlWithRetry = jest.fn().mockResolvedValueOnce({
      status: 202,
      headers: {},
      text: JSON.stringify({
        sessionId: 's1',
        jobId: 'job-1',
        status: 'queued',
        realtime: {
          transport: 'sse',
          streamUrl: '/events/session/s1/finalization?jobId=job-1',
          token: 'signed-token',
          expiresAt: '2099-01-01T00:00:00.000Z',
        },
      }),
    });
    const handler = {
      handleResponseAsync: jest
        .fn()
        .mockResolvedValueOnce(
          responseOk(
            '{"sessionId":"s1","jobId":"job-1","status":"queued","realtime":{"transport":"sse","streamUrl":"/events/session/s1/finalization?jobId=job-1","token":"signed-token","expiresAt":"2099-01-01T00:00:00.000Z"}}'
          )
        ),
    };

    jest.doMock('obsidian', () => ({ requestUrl: jest.fn() }));
    jest.doMock('../lib/utils/request-with-retry.util', () => ({
      requestUrlWithRetry,
    }));

    const { SessionApiClient: Client } = await import('../lib/services/session-api.client');
    const client = new Client('http://api', 'k', handler as any, mockLogger());

    const resultPromise = client.finishSession('s1', {
      notesProcessed: 1,
      assetsProcessed: 0,
    });

    const eventSource = await getCreatedEventSource();
    eventSource.emitJson('failed', {
      jobId: 'job-1',
      sessionId: 's1',
      status: 'failed',
      progress: 100,
      error: 'finalization exploded',
    });

    await expect(resultPromise).rejects.toThrow('finalization exploded');
    expect(requestUrlWithRetry).toHaveBeenCalledTimes(1);
    expect(eventSource.close).toHaveBeenCalledTimes(1);
  });

  it('falls back to polling when SSE connection errors before terminal state', async () => {
    installMockEventSource();

    const requestUrlWithRetry = jest
      .fn()
      .mockResolvedValueOnce({
        status: 202,
        headers: {},
        text: JSON.stringify({
          sessionId: 's1',
          jobId: 'job-1',
          status: 'queued',
          realtime: {
            transport: 'sse',
            streamUrl: '/events/session/s1/finalization?jobId=job-1',
            token: 'signed-token',
            expiresAt: '2099-01-01T00:00:00.000Z',
          },
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
              notesPublished: 7,
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
        .mockResolvedValueOnce(
          responseOk(
            '{"sessionId":"s1","jobId":"job-1","status":"queued","realtime":{"transport":"sse","streamUrl":"/events/session/s1/finalization?jobId=job-1","token":"signed-token","expiresAt":"2099-01-01T00:00:00.000Z"}}'
          )
        )
        .mockResolvedValueOnce(
          responseOk(
            '{"jobId":"job-1","sessionId":"s1","status":"completed","progress":100,"result":{"promotionStats":{"notesPublished":7,"notesDeduplicated":0,"notesDeleted":0,"assetsPublished":0,"assetsDeduplicated":0}}}'
          )
        ),
    };

    jest.doMock('obsidian', () => ({ requestUrl: jest.fn() }));
    jest.doMock('../lib/utils/request-with-retry.util', () => ({
      requestUrlWithRetry,
    }));

    const { SessionApiClient: Client } = await import('../lib/services/session-api.client');
    const client = new Client('http://api', 'k', handler as any, mockLogger());

    const resultPromise = client.finishSession('s1', {
      notesProcessed: 1,
      assetsProcessed: 0,
    });

    const eventSource = await getCreatedEventSource();
    eventSource.emit('error');

    await expect(resultPromise).resolves.toEqual({
      promotionStats: {
        notesPublished: 7,
        notesDeduplicated: 0,
        notesDeleted: 0,
        assetsPublished: 0,
        assetsDeduplicated: 0,
      },
    });
    expect(requestUrlWithRetry).toHaveBeenCalledTimes(2);
    expect(eventSource.close).toHaveBeenCalledTimes(1);
  });

  it('falls back to polling when SSE disconnects after the stream was connected', async () => {
    installMockEventSource();

    const requestUrlWithRetry = jest
      .fn()
      .mockResolvedValueOnce({
        status: 202,
        headers: {},
        text: JSON.stringify({
          sessionId: 's1',
          jobId: 'job-1',
          status: 'queued',
          realtime: {
            transport: 'sse',
            streamUrl: '/events/session/s1/finalization?jobId=job-1',
            token: 'signed-token',
            expiresAt: '2099-01-01T00:00:00.000Z',
          },
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
              notesPublished: 9,
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
        .mockResolvedValueOnce(
          responseOk(
            '{"sessionId":"s1","jobId":"job-1","status":"queued","realtime":{"transport":"sse","streamUrl":"/events/session/s1/finalization?jobId=job-1","token":"signed-token","expiresAt":"2099-01-01T00:00:00.000Z"}}'
          )
        )
        .mockResolvedValueOnce(
          responseOk(
            '{"jobId":"job-1","sessionId":"s1","status":"completed","progress":100,"result":{"promotionStats":{"notesPublished":9,"notesDeduplicated":0,"notesDeleted":0,"assetsPublished":0,"assetsDeduplicated":0}}}'
          )
        ),
    };

    jest.doMock('obsidian', () => ({ requestUrl: jest.fn() }));
    jest.doMock('../lib/utils/request-with-retry.util', () => ({
      requestUrlWithRetry,
    }));

    const { SessionApiClient: Client } = await import('../lib/services/session-api.client');
    const client = new Client('http://api', 'k', handler as any, mockLogger());

    const resultPromise = client.finishSession('s1', {
      notesProcessed: 1,
      assetsProcessed: 0,
    });

    const eventSource = await getCreatedEventSource();
    eventSource.emitJson('connected', {
      jobId: 'job-1',
      sessionId: 's1',
      status: 'processing',
      progress: 20,
    });
    eventSource.emitJson('status', {
      jobId: 'job-1',
      sessionId: 's1',
      status: 'processing',
      progress: 60,
    });
    eventSource.emit('error');

    await expect(resultPromise).resolves.toEqual({
      promotionStats: {
        notesPublished: 9,
        notesDeduplicated: 0,
        notesDeleted: 0,
        assetsPublished: 0,
        assetsDeduplicated: 0,
      },
    });
    expect(requestUrlWithRetry).toHaveBeenCalledTimes(2);
    expect(eventSource.close).toHaveBeenCalledTimes(1);
  });

  it('falls back to polling when SSE emits malformed payloads', async () => {
    installMockEventSource();

    const requestUrlWithRetry = jest
      .fn()
      .mockResolvedValueOnce({
        status: 202,
        headers: {},
        text: JSON.stringify({
          sessionId: 's1',
          jobId: 'job-1',
          status: 'queued',
          realtime: {
            transport: 'sse',
            streamUrl: '/events/session/s1/finalization?jobId=job-1',
            token: 'signed-token',
            expiresAt: '2099-01-01T00:00:00.000Z',
          },
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
              notesPublished: 10,
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
        .mockResolvedValueOnce(
          responseOk(
            '{"sessionId":"s1","jobId":"job-1","status":"queued","realtime":{"transport":"sse","streamUrl":"/events/session/s1/finalization?jobId=job-1","token":"signed-token","expiresAt":"2099-01-01T00:00:00.000Z"}}'
          )
        )
        .mockResolvedValueOnce(
          responseOk(
            '{"jobId":"job-1","sessionId":"s1","status":"completed","progress":100,"result":{"promotionStats":{"notesPublished":10,"notesDeduplicated":0,"notesDeleted":0,"assetsPublished":0,"assetsDeduplicated":0}}}'
          )
        ),
    };

    jest.doMock('obsidian', () => ({ requestUrl: jest.fn() }));
    jest.doMock('../lib/utils/request-with-retry.util', () => ({
      requestUrlWithRetry,
    }));

    const { SessionApiClient: Client } = await import('../lib/services/session-api.client');
    const client = new Client('http://api', 'k', handler as any, mockLogger());

    const resultPromise = client.finishSession('s1', {
      notesProcessed: 1,
      assetsProcessed: 0,
    });

    const eventSource = await getCreatedEventSource();
    eventSource.emitJson('connected', {
      jobId: 'job-1',
      sessionId: 's1',
      status: 'processing',
      progress: 10,
    });
    eventSource.emit('status', { data: '{bad-json' });

    await expect(resultPromise).resolves.toEqual({
      promotionStats: {
        notesPublished: 10,
        notesDeduplicated: 0,
        notesDeleted: 0,
        assetsPublished: 0,
        assetsDeduplicated: 0,
      },
    });
    expect(requestUrlWithRetry).toHaveBeenCalledTimes(2);
    expect(eventSource.close).toHaveBeenCalledTimes(1);
  });

  it('falls back to polling when SSE stalls without a terminal event', async () => {
    jest.useFakeTimers();
    installMockEventSource();

    const requestUrlWithRetry = jest
      .fn()
      .mockResolvedValueOnce({
        status: 202,
        headers: {},
        text: JSON.stringify({
          sessionId: 's1',
          jobId: 'job-1',
          status: 'queued',
          realtime: {
            transport: 'sse',
            streamUrl: '/events/session/s1/finalization?jobId=job-1',
            token: 'signed-token',
            expiresAt: '2099-01-01T00:00:00.000Z',
          },
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
              notesPublished: 12,
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
        .mockResolvedValueOnce(
          responseOk(
            '{"sessionId":"s1","jobId":"job-1","status":"queued","realtime":{"transport":"sse","streamUrl":"/events/session/s1/finalization?jobId=job-1","token":"signed-token","expiresAt":"2099-01-01T00:00:00.000Z"}}'
          )
        )
        .mockResolvedValueOnce(
          responseOk(
            '{"jobId":"job-1","sessionId":"s1","status":"completed","progress":100,"result":{"promotionStats":{"notesPublished":12,"notesDeduplicated":0,"notesDeleted":0,"assetsPublished":0,"assetsDeduplicated":0}}}'
          )
        ),
    };

    jest.doMock('obsidian', () => ({ requestUrl: jest.fn() }));
    jest.doMock('../lib/utils/request-with-retry.util', () => ({
      requestUrlWithRetry,
    }));

    const { SessionApiClient: Client } = await import('../lib/services/session-api.client');
    const client = new Client('http://api', 'k', handler as any, mockLogger());

    const resultPromise = client.finishSession('s1', {
      notesProcessed: 1,
      assetsProcessed: 0,
    });

    const eventSource = await getCreatedEventSourceWithFakeTimers();
    eventSource.emitJson('connected', {
      jobId: 'job-1',
      sessionId: 's1',
      status: 'processing',
      progress: 30,
    });

    await jest.advanceTimersByTimeAsync(45000);

    await expect(resultPromise).resolves.toEqual({
      promotionStats: {
        notesPublished: 12,
        notesDeduplicated: 0,
        notesDeleted: 0,
        assetsPublished: 0,
        assetsDeduplicated: 0,
      },
    });
    expect(requestUrlWithRetry).toHaveBeenCalledTimes(2);
    expect(eventSource.close).toHaveBeenCalledTimes(1);
  });

  it('uses polling only when realtime metadata is absent', async () => {
    const requestUrlWithRetry = jest
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
          status: 'completed',
          progress: 100,
          result: {
            promotionStats: {
              notesPublished: 11,
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
        .mockResolvedValueOnce(responseOk('{"sessionId":"s1","jobId":"job-1","status":"queued"}'))
        .mockResolvedValueOnce(
          responseOk(
            '{"jobId":"job-1","sessionId":"s1","status":"completed","progress":100,"result":{"promotionStats":{"notesPublished":11,"notesDeduplicated":0,"notesDeleted":0,"assetsPublished":0,"assetsDeduplicated":0}}}'
          )
        ),
    };

    jest.doMock('obsidian', () => ({ requestUrl: jest.fn() }));
    jest.doMock('../lib/utils/request-with-retry.util', () => ({
      requestUrlWithRetry,
    }));

    const { SessionApiClient: Client } = await import('../lib/services/session-api.client');
    const client = new Client('http://api', 'k', handler as any, mockLogger());

    await expect(
      client.finishSession('s1', {
        notesProcessed: 1,
        assetsProcessed: 0,
      })
    ).resolves.toEqual({
      promotionStats: {
        notesPublished: 11,
        notesDeduplicated: 0,
        notesDeleted: 0,
        assetsPublished: 0,
        assetsDeduplicated: 0,
      },
    });

    expect(MockEventSource.instances).toHaveLength(0);
    expect(requestUrlWithRetry).toHaveBeenCalledTimes(2);
  });

  it('forwards backend phases through the polling fallback', async () => {
    const requestUrlWithRetry = jest
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
          progress: 85,
          phase: 'rebuilding_indexes',
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
          phase: 'completed',
          result: {
            promotionStats: {
              notesPublished: 11,
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
        .mockResolvedValueOnce(responseOk('{"sessionId":"s1","jobId":"job-1","status":"queued"}'))
        .mockResolvedValueOnce(
          responseOk(
            '{"jobId":"job-1","sessionId":"s1","status":"processing","progress":85,"phase":"rebuilding_indexes"}'
          )
        )
        .mockResolvedValueOnce(
          responseOk(
            '{"jobId":"job-1","sessionId":"s1","status":"completed","progress":100,"phase":"completed","result":{"promotionStats":{"notesPublished":11,"notesDeduplicated":0,"notesDeleted":0,"assetsPublished":0,"assetsDeduplicated":0}}}'
          )
        ),
    };
    const onFinalizationUpdate = jest.fn();

    jest.doMock('obsidian', () => ({ requestUrl: jest.fn() }));
    jest.doMock('../lib/utils/request-with-retry.util', () => ({
      requestUrlWithRetry,
    }));

    const { SessionApiClient: Client } = await import('../lib/services/session-api.client');
    const client = new Client('http://api', 'k', handler as any, mockLogger());

    await expect(
      client.finishSession(
        's1',
        {
          notesProcessed: 1,
          assetsProcessed: 0,
        },
        { onFinalizationUpdate }
      )
    ).resolves.toEqual({
      promotionStats: {
        notesPublished: 11,
        notesDeduplicated: 0,
        notesDeleted: 0,
        assetsPublished: 0,
        assetsDeduplicated: 0,
      },
    });

    expect(onFinalizationUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ phase: 'queued', progress: 0 })
    );
    expect(onFinalizationUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ phase: 'rebuilding_indexes', progress: 85 })
    );
    expect(onFinalizationUpdate).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ phase: 'completed', progress: 100 })
    );
  });

  it('ignores duplicate terminal SSE events safely', async () => {
    installMockEventSource();

    const requestUrlWithRetry = jest.fn().mockResolvedValueOnce({
      status: 202,
      headers: {},
      text: JSON.stringify({
        sessionId: 's1',
        jobId: 'job-1',
        status: 'queued',
        realtime: {
          transport: 'sse',
          streamUrl: '/events/session/s1/finalization?jobId=job-1',
          token: 'signed-token',
          expiresAt: '2099-01-01T00:00:00.000Z',
        },
      }),
    });
    const handler = {
      handleResponseAsync: jest
        .fn()
        .mockResolvedValueOnce(
          responseOk(
            '{"sessionId":"s1","jobId":"job-1","status":"queued","realtime":{"transport":"sse","streamUrl":"/events/session/s1/finalization?jobId=job-1","token":"signed-token","expiresAt":"2099-01-01T00:00:00.000Z"}}'
          )
        ),
    };

    jest.doMock('obsidian', () => ({ requestUrl: jest.fn() }));
    jest.doMock('../lib/utils/request-with-retry.util', () => ({
      requestUrlWithRetry,
    }));

    const { SessionApiClient: Client } = await import('../lib/services/session-api.client');
    const client = new Client('http://api', 'k', handler as any, mockLogger());

    const resultPromise = client.finishSession('s1', {
      notesProcessed: 1,
      assetsProcessed: 0,
    });

    const eventSource = await getCreatedEventSource();
    eventSource.emitJson('completed', {
      jobId: 'job-1',
      sessionId: 's1',
      status: 'completed',
      progress: 100,
      result: {
        promotionStats: {
          notesPublished: 13,
          notesDeduplicated: 0,
          notesDeleted: 0,
          assetsPublished: 0,
          assetsDeduplicated: 0,
        },
      },
    });
    eventSource.emitJson('failed', {
      jobId: 'job-1',
      sessionId: 's1',
      status: 'failed',
      progress: 100,
      error: 'ignored',
    });

    await expect(resultPromise).resolves.toEqual({
      promotionStats: {
        notesPublished: 13,
        notesDeduplicated: 0,
        notesDeleted: 0,
        assetsPublished: 0,
        assetsDeduplicated: 0,
      },
    });
    expect(eventSource.close).toHaveBeenCalledTimes(1);
  });
});
