/**
 * Throttle utility for controlling update frequency
 * Prevents UI spam by limiting how often a function can be called
 */

export interface ThrottleOptions {
  /** Minimum time between calls in milliseconds */
  intervalMs: number;
  /** Whether to call immediately on first invocation */
  leading?: boolean;
  /** Whether to call after the throttle period ends */
  trailing?: boolean;
}

/**
 * Creates a throttled version of a function
 * Ensures the function is not called more than once per interval
 *
 * @param fn - Function to throttle
 * @param options - Throttle configuration
 * @returns Throttled function with flush() and cancel() methods
 */
export function throttle<T extends (...args: Parameters<T>) => void>(
  fn: T,
  options: ThrottleOptions
): ((...args: Parameters<T>) => void) & { flush: () => void; cancel: () => void } {
  const { intervalMs, leading = true, trailing = true } = options;

  let lastCallTime = 0;
  let timeoutId: NodeJS.Timeout | number | null = null;
  let lastArgs: Parameters<T> | null = null;

  const invoke = (args: Parameters<T>) => {
    lastCallTime = Date.now();
    fn(...args);
  };

  const throttled = (...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    // Clear any pending trailing call
    if (timeoutId) {
      clearTimeout(timeoutId as number);
      timeoutId = null;
    }

    // First call or enough time has passed
    if (lastCallTime === 0 && leading) {
      invoke(args);
      return;
    }

    // Enough time has passed since last call
    if (timeSinceLastCall >= intervalMs) {
      invoke(args);
      return;
    }

    // Store args for potential trailing call
    lastArgs = args;

    // Schedule trailing call if enabled
    if (trailing) {
      const remainingTime = intervalMs - timeSinceLastCall;
      timeoutId = setTimeout(() => {
        if (lastArgs) {
          invoke(lastArgs);
          lastArgs = null;
        }
        timeoutId = null;
      }, remainingTime);
    }
  };

  // Force immediate execution of pending call
  throttled.flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId as number);
      timeoutId = null;
    }
    if (lastArgs) {
      invoke(lastArgs);
      lastArgs = null;
    }
  };

  // Cancel pending call
  throttled.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId as number);
      timeoutId = null;
    }
    lastArgs = null;
  };

  return throttled;
}

/**
 * Debounce utility - waits for silence before executing
 * Different from throttle: only executes after no calls for specified time
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delayMs: number
): ((...args: Parameters<T>) => void) & { flush: () => void; cancel: () => void } {
  let timeoutId: NodeJS.Timeout | number | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debounced = (...args: Parameters<T>) => {
    lastArgs = args;

    if (timeoutId) {
      clearTimeout(timeoutId as number);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
      lastArgs = null;
      timeoutId = null;
    }, delayMs);
  };

  debounced.flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId as number);
      timeoutId = null;
    }
    if (lastArgs) {
      fn(...(lastArgs as Parameters<T>));
      lastArgs = null;
    }
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId as number);
      timeoutId = null;
    }
    lastArgs = null;
  };

  return debounced;
}
