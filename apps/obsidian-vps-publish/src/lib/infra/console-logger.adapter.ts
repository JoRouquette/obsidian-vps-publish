import { type LoggerPort, LogLevel, type LogMeta, type OperationContext } from '@core-domain';

import { DEFAULT_LOGGER_LEVEL } from '../constants/default-logger-level.constant';

export class ConsoleLoggerAdapter implements LoggerPort {
  private _level: LogLevel;
  private _context: OperationContext;

  constructor(context: OperationContext = {}, level?: LogLevel) {
    this._context = context;
    this._level = this.getComposedLevel(level ?? DEFAULT_LOGGER_LEVEL);
  }

  public set level(level: LogLevel) {
    this._level = this.getComposedLevel(level);
  }

  public get level(): LogLevel {
    return this._level;
  }

  child(context: OperationContext, level?: LogLevel): ConsoleLoggerAdapter {
    const logLevel = level === undefined ? this._level : this.getComposedLevel(level);
    return new ConsoleLoggerAdapter({ ...this._context, ...context }, logLevel);
  }

  debug(message: string, meta?: LogMeta): void {
    if ((this._level & LogLevel.debug) === 0) return;
    const data = this.mergeContextAndMeta(meta);
    console.debug(`[${this.getCurrentDatetime()}] [debug] ${message}\n${this.serialize(data)}`);
  }

  info(message: string, meta?: LogMeta): void {
    if ((this._level & LogLevel.info) === 0) return;
    const data = this.mergeContextAndMeta(meta);
    console.debug(`[${this.getCurrentDatetime()}] [info] ${message}\n${this.serialize(data)}`);
  }

  warn(message: string, meta?: LogMeta): void {
    if ((this._level & LogLevel.warn) === 0) return;
    const data = this.mergeContextAndMeta(meta);
    console.warn(`[${this.getCurrentDatetime()}] [warn] ${message}\n${this.serialize(data)}`);
  }

  error(message: string, meta?: LogMeta): void {
    if ((this._level & LogLevel.error) === 0) return;
    const data = this.mergeContextAndMeta(meta);
    console.error(`[${this.getCurrentDatetime()}] [error] ${message}\n${this.serialize(data)}`);
  }

  private mergeContextAndMeta(meta?: LogMeta): Record<string, unknown> {
    return { ...this._context, ...(meta ?? {}) };
  }

  private serialize(data: Record<string, unknown>): string {
    try {
      return JSON.stringify(data, this.jsonReplacer, 2);
    } catch {
      return String(data);
    }
  }

  private jsonReplacer(_key: string, value: unknown): unknown {
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }

    if (value instanceof Set) {
      return Array.from(value);
    }

    if (value instanceof Map) {
      return Object.fromEntries(value);
    }

    return value;
  }

  private getCurrentDatetime(): string {
    return new Date().toISOString();
  }

  private getComposedLevel(level: LogLevel): LogLevel {
    const bits = [LogLevel.error, LogLevel.warn, LogLevel.info, LogLevel.debug].filter(
      (l) => (level & l) !== 0
    ).length;

    if (bits > 1) {
      return level;
    }

    switch (level) {
      case LogLevel.debug:
        return LogLevel.debug | LogLevel.info | LogLevel.warn | LogLevel.error;
      case LogLevel.info:
        return LogLevel.info | LogLevel.warn | LogLevel.error;
      case LogLevel.warn:
        return LogLevel.warn | LogLevel.error;
      case LogLevel.error:
        return LogLevel.error;
      default:
        return this.getComposedLevel(DEFAULT_LOGGER_LEVEL);
    }
  }
}
