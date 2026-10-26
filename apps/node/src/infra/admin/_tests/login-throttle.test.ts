import { createLoginThrottle, type LoginAttempt } from '../login-throttle';

const MAX_FAILURES = 3;
const WINDOW_MS = 60_000;

function acquired(attempt: LoginAttempt): Extract<LoginAttempt, { ok: true }> {
  if (!attempt.ok) {
    throw new Error('expected the attempt to be granted');
  }
  return attempt;
}

function blocked(attempt: LoginAttempt): Extract<LoginAttempt, { ok: false }> {
  if (attempt.ok) {
    throw new Error('expected the attempt to be blocked');
  }
  return attempt;
}

describe('createLoginThrottle', () => {
  let now: number;

  function build() {
    return createLoginThrottle({ maxFailures: MAX_FAILURES, windowMs: WINDOW_MS, now: () => now });
  }

  function failTimes(throttle: ReturnType<typeof build>, count: number): void {
    for (let i = 0; i < count; i++) {
      acquired(throttle.tryAcquire()).release(true);
    }
  }

  beforeEach(() => {
    now = 1_000;
  });

  it('grants attempts while failures stay under the limit', () => {
    const throttle = build();

    failTimes(throttle, MAX_FAILURES - 1);

    expect(throttle.tryAcquire().ok).toBe(true);
  });

  it('blocks once the limit is reached and reports the time left in the window', () => {
    const throttle = build();
    failTimes(throttle, MAX_FAILURES);
    now += 10_000;

    const attempt = blocked(throttle.tryAcquire());

    expect(attempt.retryAfterSeconds).toBe(50);
  });

  it('grants attempts again once the oldest failures leave the window', () => {
    const throttle = build();
    failTimes(throttle, MAX_FAILURES);

    now += WINDOW_MS;

    expect(throttle.tryAcquire().ok).toBe(true);
  });

  it('does not record a success as a failure', () => {
    const throttle = build();

    for (let i = 0; i < MAX_FAILURES * 2; i++) {
      acquired(throttle.tryAcquire()).release(false);
    }

    expect(throttle.tryAcquire().ok).toBe(true);
  });

  it('counts in-flight attempts against the limit', () => {
    const throttle = build();
    for (let i = 0; i < MAX_FAILURES; i++) {
      acquired(throttle.tryAcquire());
    }

    const attempt = blocked(throttle.tryAcquire());

    expect(attempt.retryAfterSeconds).toBe(1);
  });

  it('frees an in-flight slot when the attempt is released without a failure', () => {
    const throttle = build();
    const inFlight = Array.from({ length: MAX_FAILURES }, () => acquired(throttle.tryAcquire()));

    inFlight[0].release(false);

    expect(throttle.tryAcquire().ok).toBe(true);
  });

  it('ignores a second release of the same attempt', () => {
    const throttle = build();
    const first = acquired(throttle.tryAcquire());
    acquired(throttle.tryAcquire());
    acquired(throttle.tryAcquire());

    first.release(false);
    first.release(false);

    acquired(throttle.tryAcquire());
    expect(throttle.tryAcquire().ok).toBe(false);
  });

  it('flags only the first refusal of a blocked episode', () => {
    const throttle = build();
    failTimes(throttle, MAX_FAILURES);

    const first = blocked(throttle.tryAcquire());
    const second = blocked(throttle.tryAcquire());

    expect(first.blockStarted).toBe(true);
    expect(second.blockStarted).toBe(false);
  });

  it('flags a new episode after attempts were granted again', () => {
    const throttle = build();
    failTimes(throttle, MAX_FAILURES);
    blocked(throttle.tryAcquire());

    now += WINDOW_MS;
    acquired(throttle.tryAcquire()).release(false);
    failTimes(throttle, MAX_FAILURES);

    expect(blocked(throttle.tryAcquire()).blockStarted).toBe(true);
  });

  it('never reports a retry delay under one second', () => {
    const throttle = build();
    failTimes(throttle, MAX_FAILURES);
    now += WINDOW_MS - 1;

    expect(blocked(throttle.tryAcquire()).retryAfterSeconds).toBe(1);
  });
});
