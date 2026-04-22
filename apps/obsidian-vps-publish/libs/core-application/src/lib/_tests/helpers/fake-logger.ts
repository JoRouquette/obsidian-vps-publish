import { type LoggerPort, LogLevel, type LogMeta, type OperationContext } from '@core-domain';

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  meta?: LogMeta;
  context: OperationContext;
}

/**
 * Fake logger for testing that captures all log calls.
 * Use this instead of NoopLogger to verify logging behavior.
 *
 * All child loggers share the same logs array as the parent.
 */
export class FakeLogger implements LoggerPort {
  private _level: LogLevel = LogLevel.debug;
  private _context: OperationContext = {};
  private readonly _logs: LogEntry[];

  private static levelOrder: Record<'debug' | 'info' | 'warn' | 'error', number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
  };

  constructor(
    context: OperationContext = {},
    level: LogLevel = LogLevel.debug,
    sharedLogs?: LogEntry[]
  ) {
    this._context = context;
    this._level = level;
    this._logs = sharedLogs ?? [];
  }

  /** Access the shared logs array */
  get logs(): LogEntry[] {
    return this._logs;
  }

  set level(level: LogLevel) {
    this._level = level;
  }

  get level(): LogLevel {
    return this._level;
  }

  child(context: OperationContext, level?: LogLevel): LoggerPort {
    // Share the same logs array with children
    return new FakeLogger({ ...this._context, ...context }, level ?? this._level, this._logs);
  }

  debug(message: string, meta?: LogMeta): void {
    if (!this.shouldLog(LogLevel.debug)) return;
    this._logs.push({ level: 'debug', message, meta, context: this._context });
  }

  info(message: string, meta?: LogMeta): void {
    if (!this.shouldLog(LogLevel.info)) return;
    this._logs.push({ level: 'info', message, meta, context: this._context });
  }

  warn(message: string, meta?: LogMeta): void {
    if (!this.shouldLog(LogLevel.warn)) return;
    this._logs.push({ level: 'warn', message, meta, context: this._context });
  }

  error(message: string, meta?: LogMeta): void {
    if (!this.shouldLog(LogLevel.error)) return;
    this._logs.push({ level: 'error', message, meta, context: this._context });
  }

  private shouldLog(level: LogLevel): boolean {
    const normalized = this.levelToString(level);
    const current = this.levelToString(this._level);
    return FakeLogger.levelOrder[normalized] >= FakeLogger.levelOrder[current];
  }

  private levelToString(level: LogLevel): 'debug' | 'info' | 'warn' | 'error' {
    switch (level) {
      case LogLevel.debug:
        return 'debug';
      case LogLevel.info:
        return 'info';
      case LogLevel.warn:
        return 'warn';
      case LogLevel.error:
        return 'error';
      default:
        return 'info';
    }
  }

  /** Helper to clear captured logs */
  clear(): void {
    this._logs.length = 0;
  }

  /** Helper to get logs of a specific level */
  getByLevel(level: 'debug' | 'info' | 'warn' | 'error'): LogEntry[] {
    return this._logs.filter((l) => l.level === level);
  }

  /** Helper to find logs by message substring */
  findByMessage(substring: string): LogEntry[] {
    return this._logs.filter((l) => l.message.includes(substring));
  }
}

/**
 * Noop logger that does nothing (for performance when logging isn't being tested).
 */
export class NoopLogger implements LoggerPort {
  private _level: LogLevel = LogLevel.error;

  set level(level: LogLevel) {
    this._level = level;
  }

  get level(): LogLevel {
    return this._level;
  }

  child(): LoggerPort {
    return this;
  }

  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}
