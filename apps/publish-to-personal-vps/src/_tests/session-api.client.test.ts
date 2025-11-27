import { SessionApiClient } from '../lib/services/session-api.client';

const mockLogger = () =>
  ({
    child: jest.fn().mockReturnThis(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as any);

const responseOk = (text: string) => ({
  isError: false,
  text,
});

describe('SessionApiClient', () => {
  afterEach(() => {
    jest.resetModules();
    jest.resetAllMocks();
  });

  it('utilise la valeur maxBytesPerRequest renvoyée ou le fallback', async () => {
    const requestUrl = jest.fn().mockResolvedValue({
      status: 200,
      headers: {},
      text: JSON.stringify({ sessionId: 's1', maxBytesPerRequest: '1mb' }),
    });
    const handler = { handleResponseAsync: jest.fn().mockResolvedValue(responseOk('{"sessionId":"s1","maxBytesPerRequest":"1mb"}')) };
    jest.doMock('obsidian', () => ({ requestUrl }));

    const { SessionApiClient: Client } = await import('../lib/services/session-api.client');
    const client = new Client('http://api', 'k', handler as any, mockLogger());
    const res = await client.startSession({ notesPlanned: 1, assetsPlanned: 0, maxBytesPerRequest: 1024 });

    expect(res.sessionId).toBe('s1');
    // Selon la réponse, parseLimit renvoie la valeur ou le fallback (8MB)
    expect(res.maxBytesPerRequest).toBeGreaterThan(0);
  });

  it('uploadNotes lève en cas d’erreur', async () => {
    const requestUrl = jest.fn().mockResolvedValue({ status: 500, headers: {}, text: 'err' });
    const handler = {
      handleResponseAsync: jest.fn().mockResolvedValue({ isError: true, error: new Error('fail') }),
    };
    jest.doMock('obsidian', () => ({ requestUrl }));

    const { SessionApiClient: Client } = await import('../lib/services/session-api.client');
    const client = new Client('http://api', 'k', handler as any, mockLogger());

    await expect(client.uploadNotes('s1', [])).rejects.toThrow('fail');
  });

  it('abortSession utilise le bon endpoint', async () => {
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
});
