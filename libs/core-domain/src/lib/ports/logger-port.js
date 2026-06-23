"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["error"] = 1] = "error";
    LogLevel[LogLevel["warn"] = 2] = "warn";
    LogLevel[LogLevel["info"] = 4] = "info";
    LogLevel[LogLevel["debug"] = 8] = "debug";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
