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
 */
export class FakeLogger implements LoggerPort {
  private _level: LogLevel = LogLevel.debug;
  private _context: OperationContext = {};
  public readonly logs: LogEntry[] = [];

  constructor(context: OperationContext = {}, level: LogLevel = LogLevel.debug) {
    this._context = context;
    this._level = level;
  }

  set level(level: LogLevel) {
    this._level = level;
  }

  get level(): LogLevel {
    return this._level;
  }

  child(context: OperationContext, level?: LogLevel): LoggerPort {
    return new FakeLogger({ ...this._context, ...context }, level ?? this._level);
  }

  debug(message: string, meta?: LogMeta): void {
    if ((this._level & LogLevel.debug) === 0) return;
    this.logs.push({ level: 'debug', message, meta, context: this._context });
  }

  info(message: string, meta?: LogMeta): void {
    if ((this._level & LogLevel.info) === 0) return;
    this.logs.push({ level: 'info', message, meta, context: this._context });
  }

  warn(message: string, meta?: LogMeta): void {
    if ((this._level & LogLevel.warn) === 0) return;
    this.logs.push({ level: 'warn', message, meta, context: this._context });
  }

  error(message: string, meta?: LogMeta): void {
    if ((this._level & LogLevel.error) === 0) return;
    this.logs.push({ level: 'error', message, meta, context: this._context });
  }

  /** Helper to clear captured logs */
  clear(): void {
    this.logs.length = 0;
  }

  /** Helper to get logs of a specific level */
  getByLevel(level: 'debug' | 'info' | 'warn' | 'error'): LogEntry[] {
    return this.logs.filter((l) => l.level === level);
  }

  /** Helper to find logs by message substring */
  findByMessage(substring: string): LogEntry[] {
    return this.logs.filter((l) => l.message.includes(substring));
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
