export enum LogLevel {
  error = 1,
  warn = 2,
  info = 4,
  debug = 8,
}

export interface LoggerPort {
  set level(level: LogLevel);
  get level(): LogLevel;

  child(context: Record<string, unknown>, level?: LogLevel): LoggerPort;

  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}
