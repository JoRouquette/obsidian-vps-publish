import { createHmac, timingSafeEqual } from 'node:crypto';

export interface FinalizationStreamTokenPayload {
  sessionId: string;
  jobId: string;
  exp: number;
}

export type FinalizationStreamTokenValidation =
  | {
      ok: true;
      payload: FinalizationStreamTokenPayload;
    }
  | {
      ok: false;
      reason: 'missing' | 'invalid' | 'expired' | 'scope_mismatch';
    };

export class FinalizationStreamTokenService {
  constructor(
    private readonly secret: string,
    private readonly ttlMs: number = 15 * 60 * 1000
  ) {}

  createToken(sessionId: string, jobId: string): {
    token: string;
    expiresAt: string;
    expiresAtMs: number;
  } {
    const expiresAtMs = Date.now() + this.ttlMs;
    const payload: FinalizationStreamTokenPayload = {
      sessionId,
      jobId,
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

  validateToken(
    token: string | undefined,
    expectedSessionId: string,
    expectedJobId: string
  ): FinalizationStreamTokenValidation {
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
      const payload = JSON.parse(decodeBase64Url(encodedPayload)) as FinalizationStreamTokenPayload;

      if (
        typeof payload.sessionId !== 'string' ||
        typeof payload.jobId !== 'string' ||
        typeof payload.exp !== 'number'
      ) {
        return { ok: false, reason: 'invalid' };
      }

      if (payload.exp <= Date.now()) {
        return { ok: false, reason: 'expired' };
      }

      if (payload.sessionId !== expectedSessionId || payload.jobId !== expectedJobId) {
        return { ok: false, reason: 'scope_mismatch' };
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
