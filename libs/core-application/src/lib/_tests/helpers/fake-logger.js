"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoopLogger = exports.FakeLogger = void 0;
const _core_domain_1 = require("@core-domain");
/**
 * Fake logger for testing that captures all log calls.
 * Use this instead of NoopLogger to verify logging behavior.
 *
 * All child loggers share the same logs array as the parent.
 */
class FakeLogger {
    constructor(context = {}, level = _core_domain_1.LogLevel.debug, sharedLogs) {
        this._level = _core_domain_1.LogLevel.debug;
        this._context = {};
        this._context = context;
        this._level = level;
        this._logs = sharedLogs ?? [];
    }
    /** Access the shared logs array */
    get logs() {
        return this._logs;
    }
    set level(level) {
        this._level = level;
    }
    get level() {
        return this._level;
    }
    child(context, level) {
        // Share the same logs array with children
        return new FakeLogger({ ...this._context, ...context }, level ?? this._level, this._logs);
    }
    debug(message, meta) {
        if (!this.shouldLog(_core_domain_1.LogLevel.debug))
            return;
        this._logs.push({ level: 'debug', message, meta, context: this._context });
    }
    info(message, meta) {
        if (!this.shouldLog(_core_domain_1.LogLevel.info))
            return;
        this._logs.push({ level: 'info', message, meta, context: this._context });
    }
    warn(message, meta) {
        if (!this.shouldLog(_core_domain_1.LogLevel.warn))
            return;
        this._logs.push({ level: 'warn', message, meta, context: this._context });
    }
    error(message, meta) {
        if (!this.shouldLog(_core_domain_1.LogLevel.error))
            return;
        this._logs.push({ level: 'error', message, meta, context: this._context });
    }
    shouldLog(level) {
        const normalized = this.levelToString(level);
        const current = this.levelToString(this._level);
        return FakeLogger.levelOrder[normalized] >= FakeLogger.levelOrder[current];
    }
    levelToString(level) {
        switch (level) {
            case _core_domain_1.LogLevel.debug:
                return 'debug';
            case _core_domain_1.LogLevel.info:
                return 'info';
            case _core_domain_1.LogLevel.warn:
                return 'warn';
            case _core_domain_1.LogLevel.error:
                return 'error';
            default:
                return 'info';
        }
    }
    /** Helper to clear captured logs */
    clear() {
        this._logs.length = 0;
    }
    /** Helper to get logs of a specific level */
    getByLevel(level) {
        return this._logs.filter((l) => l.level === level);
    }
    /** Helper to find logs by message substring */
    findByMessage(substring) {
        return this._logs.filter((l) => l.message.includes(substring));
    }
}
exports.FakeLogger = FakeLogger;
FakeLogger.levelOrder = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};
/**
 * Noop logger that does nothing (for performance when logging isn't being tested).
 */
class NoopLogger {
    constructor() {
        this._level = _core_domain_1.LogLevel.error;
    }
    set level(level) {
        this._level = level;
    }
    get level() {
        return this._level;
    }
    child() {
        return this;
    }
    debug() { }
    info() { }
    warn() { }
    error() { }
}
exports.NoopLogger = NoopLogger;
