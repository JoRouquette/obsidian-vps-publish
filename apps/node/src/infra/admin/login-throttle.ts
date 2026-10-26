export type LoginAttempt =
  | { ok: true; release(failed: boolean): void }
  | { ok: false; retryAfterSeconds: number; blockStarted: boolean };

export interface LoginThrottleOptions {
  maxFailures: number;
  windowMs: number;
  now: () => number;
}

export interface LoginThrottle {
  tryAcquire(): LoginAttempt;
}

/**
 * Sliding-window limiter on failed logins. A single instance guards every
 * client (see the admin auth controller for why). In-flight attempts count
 * against the limit so parallel requests cannot all slip through before the
 * first failure is recorded.
 */
export function createLoginThrottle(options: LoginThrottleOptions): LoginThrottle {
  const { maxFailures, windowMs, now } = options;
  const failureTimestamps: number[] = [];
  let attemptsInFlight = 0;
  let blocked = false;

  return {
    tryAcquire(): LoginAttempt {
      const current = now();
      while (failureTimestamps.length > 0 && failureTimestamps[0] <= current - windowMs) {
        failureTimestamps.shift();
      }
      if (failureTimestamps.length + attemptsInFlight >= maxFailures) {
        const blockStarted = !blocked;
        blocked = true;
        // Blocked only by in-flight attempts: a slot frees up as soon as one of them settles.
        const retryAfterSeconds =
          failureTimestamps.length < maxFailures
            ? 1
            : Math.max(1, Math.ceil((failureTimestamps[0] + windowMs - current) / 1000));
        return { ok: false, retryAfterSeconds, blockStarted };
      }

      blocked = false;
      attemptsInFlight++;
      let released = false;
      return {
        ok: true,
        release(failed: boolean): void {
          if (released) {
            return;
          }
          released = true;
          attemptsInFlight--;
          if (failed) {
            failureTimestamps.push(now());
          }
        },
      };
    },
  };
}
