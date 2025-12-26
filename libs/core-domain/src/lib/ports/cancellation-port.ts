/**
 * Port for cancellation support
 * Allows operations to be cancelled gracefully
 */
export interface CancellationPort {
  /**
   * Check if cancellation has been requested
   */
  readonly isCancelled: boolean;

  /**
   * Throw if cancellation has been requested
   * @throws CancellationError if cancelled
   */
  throwIfCancelled(): void;

  /**
   * Register a callback to be called when cancellation is requested
   */
  onCancel(callback: () => void): void;
}

/**
 * Error thrown when an operation is cancelled
 */
export class CancellationError extends Error {
  constructor(message = 'Operation cancelled') {
    super(message);
    this.name = 'CancellationError';
  }
}
