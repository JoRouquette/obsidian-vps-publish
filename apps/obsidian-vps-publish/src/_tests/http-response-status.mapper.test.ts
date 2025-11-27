import { RequestUrlResponseMapper } from '../lib/utils/http-response-status.mapper';

class NoopLogger {
  child() {
    return this;
  }
  debug(): void {}
}

describe('RequestUrlResponseMapper', () => {
  it('mappe une réponse Obsidian en Response standard avec statusText connu', () => {
    const mapper = new RequestUrlResponseMapper(new NoopLogger() as any);
    const res = mapper.execute(
      {
        status: 200,
        headers: { 'content-type': 'application/json' } as any,
        text: '{"ok":true}',
        arrayBuffer: async () => new ArrayBuffer(0),
        json: async () => ({}),
      } as any,
      'https://example.test'
    );

    expect(res.url).toBe('https://example.test');
    expect(res.response.status).toBe(200);
    expect(res.response.statusText).toBe('OK');
    expect(res.response.headers.get('content-type')).toBe('application/json');
  });

  it('retourne "Unknown Status" pour un code non listé', () => {
    const mapper = new RequestUrlResponseMapper(new NoopLogger() as any);
    const res = mapper.execute(
      {
        status: 499,
        headers: {} as any,
        text: 'oops',
        arrayBuffer: async () => new ArrayBuffer(0),
        json: async () => ({}),
      } as any
    );

    expect(res.response.statusText).toBe('Unknown Status');
  });
});
