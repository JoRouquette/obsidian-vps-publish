import { AdminSessionTokenService } from '../admin-session-token.service';

describe('AdminSessionTokenService', () => {
  const secret = 'username-hash:password-hash';

  it('creates a token that validates against the same secret', () => {
    const service = new AdminSessionTokenService(secret);

    const { token, expiresAt } = service.createToken();
    const result = service.validateToken(token);

    expect(result.ok).toBe(true);
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects a missing token', () => {
    const service = new AdminSessionTokenService(secret);

    expect(service.validateToken(undefined)).toEqual({ ok: false, reason: 'missing' });
  });

  it('rejects a malformed token', () => {
    const service = new AdminSessionTokenService(secret);

    expect(service.validateToken('not-a-token')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects a token with a tampered signature', () => {
    const service = new AdminSessionTokenService(secret);
    const { token } = service.createToken();
    const [payload] = token.split('.');

    const result = service.validateToken(`${payload}.deadbeef`);

    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects a token signed with a different secret', () => {
    const issuer = new AdminSessionTokenService(secret);
    const verifier = new AdminSessionTokenService('rotated-password-hash');
    const { token } = issuer.createToken();

    const result = verifier.validateToken(token);

    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects an expired token', () => {
    const service = new AdminSessionTokenService(secret, -1000);
    const { token } = service.createToken();

    const result = service.validateToken(token);

    expect(result).toEqual({ ok: false, reason: 'expired' });
  });
});
