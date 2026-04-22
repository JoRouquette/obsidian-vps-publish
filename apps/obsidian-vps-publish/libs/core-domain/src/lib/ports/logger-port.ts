export enum LogLevel {
  error = 1,
  warn = 2,
  info = 4,
  debug = 8,
}

/**
 * Context for operation tracking and correlation.
 * Used to trace operations across layers (plugin → API → processing).
 */
export interface OperationContext {
  /** Correlation ID to track requests across systems */
  correlationId?: string;
  /** Logical component/scope (e.g., "plugin.upload", "api.sessions", "site.search") */
  scope?: string;
  /** Current operation (e.g., "parseVault", "uploadNotesBatch", "sanitizeHtml") */
  operation?: string;
  /** Additional context metadata */
  [key: string]: unknown;
}

export type LogMeta = Record<string, unknown>;

/**
 * Unified logging port following Clean Architecture.
 * All infrastructure adapters must implement this interface.
 *
 * Logging Policy:
 * - debug: Exhaustive tracing (steps, timings, sizes, decisions) – no spam
 * - info: Important business/technical events (start/stop, batch completion, stats)
 * - warn: Abnormal but recoverable situations (rare, actionable by user/operator)
 * - error: Real exceptions with actionable context (operation, IDs, correlation)
 *
 * NEVER log: API keys, secrets, full content, unbounded HTML.
 * ALWAYS log: operation context, correlation ID, bounded excerpts/sizes/hashes.
 */
export interface LoggerPort {
  set level(level: LogLevel);
  get level(): LogLevel;

  /**
   * Create child logger with additional context (scope, correlation ID, operation).
   * Context is merged and propagated to all subsequent logs.
   */
  child(context: OperationContext, level?: LogLevel): LoggerPort;

  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
}
