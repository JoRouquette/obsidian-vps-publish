import { type LoggerPort, LogLevel } from '@core-domain/ports/logger-port';

import { DEFAULT_LOGGER_LEVEL } from '../constants/default-logger-level.constant';

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
    this._level = this.getComposedLevel(level ?? DEFAULT_LOGGER_LEVEL);
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

    const data = this.flattenArgs(args);
    console.debug(`[${this.getCurrentDatetime()}] [debug] ${message}\n${this.serialize(data)}`);
  }

  warn(message: string, ...args: unknown[]): void {
    if ((this._level & LogLevel.warn) === 0) {
      return;
    }

    const data = this.flattenArgs(args);
    console.warn(`[${this.getCurrentDatetime()}] [warn] ${message}\n${this.serialize(data)}`);
  }

  error(message: string, ...args: unknown[]): void {
    if ((this._level & LogLevel.error) === 0) {
      return;
    }

    const data = this.flattenArgs(args);
    console.error(`[${this.getCurrentDatetime()}] [error] ${message}\n${this.serialize(data)}`);
  }

  private flattenArgs(args: unknown[]): Record<string, unknown> {
    const result: Record<string, unknown> = { ...this._context };

    args.forEach((arg, index) => {
      if (arg !== null && typeof arg === 'object' && !Array.isArray(arg)) {
        // Merge object arguments
        Object.assign(result, arg);
      } else {
        // For non-object arguments, use indexed key
        result[`arg${index}`] = arg;
      }
    });

    return result;
  }

  private serialize(data: Record<string, unknown>): string {
    try {
      return JSON.stringify(data, this.jsonReplacer, 2);
    } catch {
      // Fallback si circular reference ou autre erreur
      return String(data);
    }
  }

  private jsonReplacer(key: string, value: unknown): unknown {
    // Gérer les erreurs
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }

    // Gérer les circular references (Set, Map, etc.)
    if (value instanceof Set) {
      return Array.from(value);
    }

    if (value instanceof Map) {
      return Object.fromEntries(value);
    }

    // Autres types restent inchangés
    return value;
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
      case LogLevel.warn:
        return LogLevel.warn | LogLevel.error;
      case LogLevel.error:
        return LogLevel.error;
      default:
        return this.getComposedLevel(DEFAULT_LOGGER_LEVEL);
    }
  }
}
