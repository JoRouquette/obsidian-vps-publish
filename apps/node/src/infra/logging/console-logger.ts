import { LoggerPort, LogMeta } from '@core-application';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ConsoleLoggerOptions {
  level?: LogLevel;
  context?: LogMeta;
}

export class ConsoleLogger implements LoggerPort {
  private readonly level: LogLevel;
  private readonly context: LogMeta;

  private static levelOrder: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
  };

  constructor(options: ConsoleLoggerOptions = {}) {
    this.level = options.level ?? 'info';
    this.context = options.context ?? {};
  }

  child(context: LogMeta): LoggerPort {
    return new ConsoleLogger({
      level: this.level,
      context: { ...this.context, ...context },
    });
  }

  debug(message: string, meta?: LogMeta): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: LogMeta): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: LogMeta): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: LogMeta): void {
    this.log('error', message, meta);
  }

  private log(level: LogLevel, message: string, meta?: LogMeta): void {
    if (ConsoleLogger.levelOrder[level] < ConsoleLogger.levelOrder[this.level]) {
      return;
    }

    const payload = {
      level,
      message,
      ...this.context,
      ...(meta ?? {}),
      timestamp: new Date().toISOString(),
    };

    const line = JSON.stringify(payload);

    switch (level) {
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
}
