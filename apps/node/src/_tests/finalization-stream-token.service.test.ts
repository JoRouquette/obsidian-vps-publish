import { FinalizationStreamTokenService } from '../infra/http/express/finalization-stream-token.service';

describe('FinalizationStreamTokenService', () => {
  const service = new FinalizationStreamTokenService('test-secret', 60_000);

  it('accepts a valid token only for its exact session and job scope', () => {
    const { token } = service.createToken('session-1', 'job-1');

    expect(service.validateToken(token, 'session-1', 'job-1')).toMatchObject({
      ok: true,
      payload: expect.objectContaining({
        sessionId: 'session-1',
        jobId: 'job-1',
      }),
    });
    expect(service.validateToken(token, 'session-1', 'job-2')).toEqual({
      ok: false,
      reason: 'scope_mismatch',
    });
    expect(service.validateToken(token, 'session-2', 'job-1')).toEqual({
      ok: false,
      reason: 'scope_mismatch',
    });
  });

  it('rejects a tampered token', () => {
    const { token } = service.createToken('session-1', 'job-1');
    const tamperedToken = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;

    expect(service.validateToken(tamperedToken, 'session-1', 'job-1')).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });
});
