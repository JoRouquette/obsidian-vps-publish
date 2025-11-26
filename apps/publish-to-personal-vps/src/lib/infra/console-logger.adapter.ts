import { LoggerPort, LogLevel } from '@core-domain/ports/logger-port';
import { defaultLoggerLevel } from '../constants/default-logger-level.constant';

/*
export enum LogLevel {
  error = 1,
  warn = 2,
  info = 4,
  debug = 8,
}

*/

export class ConsoleLoggerAdapter implements LoggerPort {
  private _level: LogLevel;
  private _context: Record<string, unknown>;

  constructor(context: Record<string, unknown>, level?: LogLevel) {
    this._context = context;
    this._level = this.getComposedLevel(level ?? defaultLoggerLevel);
  }

  public set level(level: LogLevel) {
    this._level = this.getComposedLevel(level);
  }

  public get level(): LogLevel {
    return this._level;
  }

  child(context: Record<string, unknown>, level?: LogLevel): ConsoleLoggerAdapter {
    let logLevel;
    if (level === undefined) {
      logLevel = this._level;
    } else {
      logLevel = this.getComposedLevel(level);
    }

    return new ConsoleLoggerAdapter({ ...this._context, ...context }, logLevel);
  }

  debug(message: string, ...args: unknown[]): void {
    if ((this._level & LogLevel.debug) === 0) {
      return;
    }

    console.debug(`[${this.getCurrentDatetime()}] [debug]`, message, ...args, this._context);
  }

  info(message: string, ...args: unknown[]): void {
    if ((this._level & LogLevel.info) === 0) {
      return;
    }

    console.info(`[${this.getCurrentDatetime()}] [info]`, message, ...args, this._context);
  }

  warn(message: string, ...args: unknown[]): void {
    if ((this._level & LogLevel.warn) === 0) {
      return;
    }

    console.warn(`[${this.getCurrentDatetime()}] [warn]`, message, ...args, this._context);
  }

  error(message: string, ...args: unknown[]): void {
    if ((this._level & LogLevel.error) === 0) {
      return;
    }

    console.error(`[${this.getCurrentDatetime()}] [error]`, message, ...args, this._context);
  }

  private getCurrentDatetime(): string {
    return new Date().toISOString();
  }

  private getComposedLevel(level: LogLevel): LogLevel {
    // Si le niveau contient plusieurs bits, on considère que c'est déjà un masque
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
        return this.getComposedLevel(defaultLoggerLevel);
    }
  }
}
