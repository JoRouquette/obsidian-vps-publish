/**
 * Window-aware timers.
 * In an Obsidian popout window the global timers belong to the main window, so
 * `window.*` must be used when it exists. On the Node server (and in Jest with
 * testEnvironment node) `window` is absent and the global timers are used.
 * `window` is detected at each call, never at import time.
 */

export type TimerHandle = number | ReturnType<typeof setTimeout>;
export type IntervalHandle = number | ReturnType<typeof setInterval>;

/**
 * Timers of the host runtime, read at each call so fake timers installed later are honoured.
 * Only reached where window is absent (Node server, Jest node environment).
 */
interface HostTimers {
  setTimeout: typeof setTimeout;
  setInterval: typeof setInterval;
  clearInterval: typeof clearInterval;
}

// Callers destructure the result, so the timers run without 	his bound to the object.
function hostTimers(): HostTimers {
  return { setTimeout, setInterval, clearInterval };
}

export function setTimeoutSafe(callback: () => void, ms?: number): TimerHandle {
  if (typeof window !== 'undefined') {
    return window.setTimeout(callback, ms);
  }
  const { setTimeout: hostSetTimeout } = hostTimers();
  return hostSetTimeout(callback, ms);
}

export function setIntervalSafe(callback: () => void, ms?: number): IntervalHandle {
  if (typeof window !== 'undefined') {
    return window.setInterval(callback, ms);
  }
  const { setInterval: hostSetInterval } = hostTimers();
  return hostSetInterval(callback, ms);
}

export function clearIntervalSafe(handle: IntervalHandle): void {
  if (typeof window !== 'undefined' && typeof handle === 'number') {
    window.clearInterval(handle);
    return;
  }
  const { clearInterval: hostClearInterval } = hostTimers();
  hostClearInterval(handle);
}
