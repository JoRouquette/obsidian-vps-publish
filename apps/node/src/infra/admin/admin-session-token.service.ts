import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export interface AdminSessionTokenPayload {
  sub: 'admin';
  jti: string;
  exp: number;
}

export type AdminSessionTokenValidation =
  | {
      ok: true;
      payload: AdminSessionTokenPayload;
    }
  | {
      ok: false;
      reason: 'missing' | 'invalid' | 'expired' | 'revoked';
    };

const DEFAULT_TTL_MS = 15 * 60 * 1000;
const DEFAULT_MAX_REVOKED_TOKENS = 10_000;

/**
 * Issues and verifies short-lived, signed admin session tokens so the browser
 * never has to persist or re-send the admin password. Mirrors the finalization
 * stream token service (base64url payload + HMAC-SHA256 signature + expiry).
 *
 * The signing secret is derived by the caller from the admin username/password
 * hashes, so rotating the admin password automatically invalidates every
 * previously issued token.
 *
 * Logged-out tokens are kept in an in-memory deny list until they expire. The
 * list is lost on restart, which is acceptable given the short token lifetime.
 */
export class AdminSessionTokenService {
  // jti -> exp, so entries can be dropped once the token would be refused as expired anyway.
  private readonly revokedTokens = new Map<string, number>();

  constructor(
    private readonly secret: string,
    private readonly ttlMs: number = DEFAULT_TTL_MS,
    private readonly maxRevokedTokens: number = DEFAULT_MAX_REVOKED_TOKENS
  ) {}

  get revokedTokenCount(): number {
    return this.revokedTokens.size;
  }

  createToken(): { token: string; expiresAt: string; expiresAtMs: number } {
    const expiresAtMs = Date.now() + this.ttlMs;
    const payload: AdminSessionTokenPayload = {
      sub: 'admin',
      jti: randomUUID(),
      exp: expiresAtMs,
    };

    const encodedPayload = encodeBase64Url(JSON.stringify(payload));
    const signature = this.sign(encodedPayload);

    return {
      token: `${encodedPayload}.${signature}`,
      expiresAt: new Date(expiresAtMs).toISOString(),
      expiresAtMs,
    };
  }

  validateToken(token: string | undefined): AdminSessionTokenValidation {
    const result = this.verifyToken(token);
    if (result.ok && this.revokedTokens.has(result.payload.jti)) {
      return { ok: false, reason: 'revoked' };
    }
    return result;
  }

  /**
   * Denies a token for the rest of its lifetime. Tokens that do not carry a
   * valid signature, or are already expired, are ignored: only a token this
   * service issued can occupy a slot in the deny list.
   */
  revokeToken(token: string | undefined): void {
    const result = this.verifyToken(token);
    if (!result.ok) {
      return;
    }

    this.purgeExpiredRevocations();
    if (this.revokedTokens.size >= this.maxRevokedTokens) {
      // Reaching the cap needs that many successful logins within one TTL. Evicting the entry
      // with the smallest exp keeps memory bounded while re-allowing, for the shortest possible
      // time, the token that would have expired first anyway.
      this.evictRevocationClosestToExpiry();
    }
    this.revokedTokens.set(result.payload.jti, result.payload.exp);
  }

  private evictRevocationClosestToExpiry(): void {
    let evictedJti: string | undefined;
    let smallestExp: number = Number.POSITIVE_INFINITY;
    for (const [jti, exp] of this.revokedTokens) {
      if (exp < smallestExp) {
        smallestExp = exp;
        evictedJti = jti;
      }
    }
    if (evictedJti !== undefined) {
      this.revokedTokens.delete(evictedJti);
    }
  }

  private purgeExpiredRevocations(): void {
    const now = Date.now();
    for (const [jti, exp] of this.revokedTokens) {
      if (exp <= now) {
        this.revokedTokens.delete(jti);
      }
    }
  }

  private verifyToken(token: string | undefined): AdminSessionTokenValidation {
    if (!token) {
      return { ok: false, reason: 'missing' };
    }

    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) {
      return { ok: false, reason: 'invalid' };
    }

    const expectedSignature = this.sign(encodedPayload);
    const providedSignature = Buffer.from(signature);
    const computedSignature = Buffer.from(expectedSignature);

    if (
      providedSignature.length !== computedSignature.length ||
      !timingSafeEqual(providedSignature, computedSignature)
    ) {
      return { ok: false, reason: 'invalid' };
    }

    try {
      const payload: unknown = JSON.parse(decodeBase64Url(encodedPayload));

      // Tokens issued before jti existed fail here, so they cannot dodge revocation.
      if (!isAdminSessionTokenPayload(payload)) {
        return { ok: false, reason: 'invalid' };
      }

      if (payload.exp <= Date.now()) {
        return { ok: false, reason: 'expired' };
      }

      return { ok: true, payload };
    } catch {
      return { ok: false, reason: 'invalid' };
    }
  }

  private sign(encodedPayload: string): string {
    return createHmac('sha256', this.secret).update(encodedPayload).digest('base64url');
  }
}

function isAdminSessionTokenPayload(value: unknown): value is AdminSessionTokenPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const jti = record['jti'];
  return (
    record['sub'] === 'admin' &&
    typeof jti === 'string' &&
    jti.length > 0 &&
    typeof record['exp'] === 'number'
  );
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}
