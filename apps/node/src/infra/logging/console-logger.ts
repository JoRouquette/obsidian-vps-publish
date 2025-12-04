import { LoggerPort, LogLevel } from '@core-domain';

type ConsoleLevel = 'debug' | 'info' | 'warn' | 'error';
type LogMeta = Record<string, unknown>;

export interface ConsoleLoggerOptions {
  level?: ConsoleLevel | LogLevel;
  context?: LogMeta;
}

export class ConsoleLogger implements LoggerPort {
  private _level: LogLevel;
  private readonly context: LogMeta;

  private static levelOrder: Record<ConsoleLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
  };

  constructor(options: ConsoleLoggerOptions = {}) {
    this._level = this.normalizeLevel(options.level ?? 'info');
    this.context = options.context ?? {};
  }

  set level(level: LogLevel) {
    this._level = level;
  }

  get level(): LogLevel {
    return this._level;
  }

  child(context: LogMeta, level?: LogLevel): LoggerPort {
    return new ConsoleLogger({
      level: level ?? this._level,
      context: { ...this.context, ...context },
    });
  }

  debug(message: string, meta?: LogMeta): void {
    this.log(LogLevel.debug, message, meta);
  }

  info(message: string, meta?: LogMeta): void {
    this.log(LogLevel.info, message, meta);
  }

  warn(message: string, meta?: LogMeta): void {
    this.log(LogLevel.warn, message, meta);
  }

  error(message: string, meta?: LogMeta): void {
    this.log(LogLevel.error, message, meta);
  }

  private log(level: LogLevel, message: string, meta?: LogMeta): void {
    const normalized = this.levelToConsole(level);
    const current = this.levelToConsole(this._level);

    if (ConsoleLogger.levelOrder[normalized] < ConsoleLogger.levelOrder[current]) {
      return;
    }

    const payload = {
      level: normalized,
      message,
      ...this.context,
      ...(meta ?? {}),
      timestamp: new Date().toISOString(),
    };

    const line = JSON.stringify(payload);

    switch (normalized) {
      case 'debug':
        console.debug(line);
        break;
      case 'info':
        console.log(line);
        break;
      case 'warn':
        console.warn(line);
        break;
      case 'error':
        console.error(line);
        break;
    }
  }

  private normalizeLevel(level: ConsoleLevel | LogLevel): LogLevel {
    if (typeof level === 'number') {
      return level;
    }
    switch (level) {
      case 'debug':
        return LogLevel.debug;
      case 'warn':
        return LogLevel.warn;
      case 'error':
        return LogLevel.error;
      case 'info':
      default:
        return LogLevel.info;
    }
  }

  private levelToConsole(level: LogLevel): ConsoleLevel {
    switch (level) {
      case LogLevel.debug:
        return 'debug';
      case LogLevel.warn:
        return 'warn';
      case LogLevel.error:
        return 'error';
      case LogLevel.info:
      default:
        return 'info';
    }
  }
}
