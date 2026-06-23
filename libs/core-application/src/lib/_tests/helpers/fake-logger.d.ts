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
export declare class FakeLogger implements LoggerPort {
    private _level;
    private _context;
    private readonly _logs;
    private static levelOrder;
    constructor(context?: OperationContext, level?: LogLevel, sharedLogs?: LogEntry[]);
    /** Access the shared logs array */
    get logs(): LogEntry[];
    set level(level: LogLevel);
    get level(): LogLevel;
    child(context: OperationContext, level?: LogLevel): LoggerPort;
    debug(message: string, meta?: LogMeta): void;
    info(message: string, meta?: LogMeta): void;
    warn(message: string, meta?: LogMeta): void;
    error(message: string, meta?: LogMeta): void;
    private shouldLog;
    private levelToString;
    /** Helper to clear captured logs */
    clear(): void;
    /** Helper to get logs of a specific level */
    getByLevel(level: 'debug' | 'info' | 'warn' | 'error'): LogEntry[];
    /** Helper to find logs by message substring */
    findByMessage(substring: string): LogEntry[];
}
/**
 * Noop logger that does nothing (for performance when logging isn't being tested).
 */
export declare class NoopLogger implements LoggerPort {
    private _level;
    set level(level: LogLevel);
    get level(): LogLevel;
    child(): LoggerPort;
    debug(): void;
    info(): void;
    warn(): void;
    error(): void;
}
//# sourceMappingURL=fake-logger.d.ts.map