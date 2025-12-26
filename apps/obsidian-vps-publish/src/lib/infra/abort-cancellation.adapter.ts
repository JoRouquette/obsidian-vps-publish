import { CancellationError, type CancellationPort } from '@core-domain/ports/cancellation-port';

/**
 * Adapter for AbortController to CancellationPort
 * Bridges browser/Node AbortController to domain cancellation interface
 */
export class AbortCancellationAdapter implements CancellationPort {
  private readonly callbacks: Array<() => void> = [];

  constructor(private readonly signal: AbortSignal) {
    // Register internal handler to trigger callbacks
    this.signal.addEventListener('abort', () => {
      for (const callback of this.callbacks) {
        try {
          callback();
        } catch (error) {
          // Ignore callback errors to ensure all callbacks run
          console.error('Error in cancellation callback', error);
        }
      }
    });
  }

  get isCancelled(): boolean {
    return this.signal.aborted;
  }

  throwIfCancelled(): void {
    if (this.signal.aborted) {
      throw new CancellationError('Operation was cancelled');
    }
  }

  onCancel(callback: () => void): void {
    if (this.signal.aborted) {
      // Already cancelled, call immediately
      callback();
    } else {
      this.callbacks.push(callback);
    }
  }
}
