import { createHmac, timingSafeEqual } from 'node:crypto';

export interface AdminSessionTokenPayload {
  sub: 'admin';
  exp: number;
}

export type AdminSessionTokenValidation =
  | {
      ok: true;
      payload: AdminSessionTokenPayload;
    }
  | {
      ok: false;
      reason: 'missing' | 'invalid' | 'expired';
    };

const DEFAULT_TTL_MS = 60 * 60 * 1000;

/**
 * Issues and verifies short-lived, signed admin session tokens so the browser
 * never has to persist or re-send the admin password. Mirrors the finalization
 * stream token service (base64url payload + HMAC-SHA256 signature + expiry).
 *
 * The signing secret is derived by the caller from the admin username/password
 * hashes, so rotating the admin password automatically invalidates every
 * previously issued token.
 */
export class AdminSessionTokenService {
  constructor(
    private readonly secret: string,
    private readonly ttlMs: number = DEFAULT_TTL_MS
  ) {}

  createToken(): { token: string; expiresAt: string; expiresAtMs: number } {
    const expiresAtMs = Date.now() + this.ttlMs;
    const payload: AdminSessionTokenPayload = { sub: 'admin', exp: expiresAtMs };

    const encodedPayload = encodeBase64Url(JSON.stringify(payload));
    const signature = this.sign(encodedPayload);

    return {
      token: `${encodedPayload}.${signature}`,
      expiresAt: new Date(expiresAtMs).toISOString(),
      expiresAtMs,
    };
  }

  validateToken(token: string | undefined): AdminSessionTokenValidation {
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
      const payload = JSON.parse(decodeBase64Url(encodedPayload)) as AdminSessionTokenPayload;

      if (payload.sub !== 'admin' || typeof payload.exp !== 'number') {
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

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}
