import { createHmac } from 'node:crypto';

import { AdminSessionTokenService } from '../admin-session-token.service';

function readPayload(token: string): Record<string, unknown> {
  const [encodedPayload = ''] = token.split('.');
  return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;
}

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

  it('rejects a signature that differs by one character but has the same length', () => {
    const service = new AdminSessionTokenService(secret);
    const { token } = service.createToken();
    const [payload = '', signature = ''] = token.split('.');
    const lastChar = signature.slice(-1);
    const mutated = `${signature.slice(0, -1)}${lastChar === 'A' ? 'B' : 'A'}`;

    const result = service.validateToken(`${payload}.${mutated}`);

    expect(mutated).toHaveLength(signature.length);
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects a payload rewritten with a later expiry under the original signature', () => {
    const service = new AdminSessionTokenService(secret);
    const { token } = service.createToken();
    const [payload = '', signature = ''] = token.split('.');
    const original = readPayload(token);
    const extended = Buffer.from(
      JSON.stringify({ ...original, exp: (original['exp'] as number) + 86_400_000 }),
      'utf8'
    ).toString('base64url');

    const result = service.validateToken(`${extended}.${signature}`);

    expect(extended).not.toBe(payload);
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  describe('correctly signed payloads that are not admin session claims', () => {
    function signedToken(rawPayload: string): string {
      const encoded = Buffer.from(rawPayload, 'utf8').toString('base64url');
      const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
      return `${encoded}.${signature}`;
    }

    it.each([
      ['invalid JSON', '{not json'],
      ['a non-object JSON value', '"admin"'],
      [
        'a subject other than admin',
        JSON.stringify({ sub: 'user', jti: 'j', exp: Date.now() + 60_000 }),
      ],
      ['a non-numeric expiry', JSON.stringify({ sub: 'admin', jti: 'j', exp: 'soon' })],
    ])('rejects %s', (_, rawPayload) => {
      const service = new AdminSessionTokenService(secret);

      expect(service.validateToken(signedToken(rawPayload))).toEqual({
        ok: false,
        reason: 'invalid',
      });
    });
  });

  describe('token shape', () => {
    it.each([
      ['a trailing segment', (token: string) => `${token}.x`],
      ['an empty signature', (token: string) => `${token.split('.')[0]}.`],
      ['an empty payload', (token: string) => `.${token.split('.')[1]}`],
      ['a single segment', (token: string) => token.split('.')[0] ?? ''],
    ])('rejects a token with %s', (_, mutate) => {
      const service = new AdminSessionTokenService(secret);
      const { token } = service.createToken();

      expect(service.validateToken(mutate(token))).toEqual({ ok: false, reason: 'invalid' });
    });
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

  describe('lifetime and identity', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('expires tokens after 15 minutes by default', () => {
      const issuedAt = 1_700_000_000_000;
      jest.spyOn(Date, 'now').mockReturnValue(issuedAt);
      const service = new AdminSessionTokenService(secret);

      const { expiresAtMs } = service.createToken();

      expect(expiresAtMs).toBe(issuedAt + 15 * 60 * 1000);
    });

    it('gives every token a distinct jti', () => {
      const service = new AdminSessionTokenService(secret);

      const first = readPayload(service.createToken().token);
      const second = readPayload(service.createToken().token);

      expect(typeof first['jti']).toBe('string');
      expect(first['jti']).not.toBe(second['jti']);
    });

    it('rejects a correctly signed token that carries no jti', () => {
      const service = new AdminSessionTokenService(secret);
      const legacyPayload = Buffer.from(
        JSON.stringify({ sub: 'admin', exp: Date.now() + 60_000 }),
        'utf8'
      ).toString('base64url');
      const signature = createHmac('sha256', secret).update(legacyPayload).digest('base64url');

      const result = service.validateToken(`${legacyPayload}.${signature}`);

      expect(result).toEqual({ ok: false, reason: 'invalid' });
    });
  });

  describe('revocation', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('rejects a revoked token with reason revoked', () => {
      const service = new AdminSessionTokenService(secret);
      const { token } = service.createToken();

      service.revokeToken(token);

      expect(service.validateToken(token)).toEqual({ ok: false, reason: 'revoked' });
    });

    it('keeps other tokens valid when one is revoked', () => {
      const service = new AdminSessionTokenService(secret);
      const revoked = service.createToken().token;
      const kept = service.createToken().token;

      service.revokeToken(revoked);

      expect(service.validateToken(kept).ok).toBe(true);
    });

    it('ignores missing, forged or foreign tokens', () => {
      const service = new AdminSessionTokenService(secret);
      const foreign = new AdminSessionTokenService('other-secret').createToken().token;

      service.revokeToken(undefined);
      service.revokeToken('not-a-token');
      service.revokeToken(foreign);

      expect(service.revokedTokenCount).toBe(0);
    });

    it('treats revoking the same token twice as a no-op', () => {
      const service = new AdminSessionTokenService(secret);
      const { token } = service.createToken();

      service.revokeToken(token);
      service.revokeToken(token);

      expect(service.revokedTokenCount).toBe(1);
    });

    it('purges revocations whose token has expired', () => {
      const issuedAt = 1_700_000_000_000;
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(issuedAt);
      const service = new AdminSessionTokenService(secret, 1_000);
      service.revokeToken(service.createToken().token);
      nowSpy.mockReturnValue(issuedAt + 500);
      const laterToken = service.createToken().token;

      nowSpy.mockReturnValue(issuedAt + 1_200);
      service.revokeToken(laterToken);

      expect(service.revokedTokenCount).toBe(1);
      expect(service.validateToken(laterToken)).toEqual({ ok: false, reason: 'revoked' });
    });

    it('evicts the revocation with the smallest exp when the deny list is full, whatever the revocation order', () => {
      const issuedAt = 1_700_000_000_000;
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(issuedAt);
      const service = new AdminSessionTokenService(secret, 60_000, 2);
      const expiresFirst = service.createToken().token;
      nowSpy.mockReturnValue(issuedAt + 100);
      const expiresSecond = service.createToken().token;
      nowSpy.mockReturnValue(issuedAt + 200);
      const expiresLast = service.createToken().token;

      // Revoked in the opposite order of expiry, so insertion order would evict the wrong one.
      service.revokeToken(expiresSecond);
      service.revokeToken(expiresFirst);
      service.revokeToken(expiresLast);

      expect(service.revokedTokenCount).toBe(2);
      expect(service.validateToken(expiresFirst).ok).toBe(true);
      expect(service.validateToken(expiresSecond)).toEqual({ ok: false, reason: 'revoked' });
      expect(service.validateToken(expiresLast)).toEqual({ ok: false, reason: 'revoked' });
    });

    it('does not record a correctly signed token that has already expired', () => {
      const issuedAt = 1_700_000_000_000;
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(issuedAt);
      const service = new AdminSessionTokenService(secret, 1_000);
      const { token } = service.createToken();

      nowSpy.mockReturnValue(issuedAt + 1_001);
      service.revokeToken(token);

      expect(service.revokedTokenCount).toBe(0);
    });
  });
});
