"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionInvalidError = exports.SessionExpiredError = exports.SessionNotFoundError = exports.SessionError = void 0;
class SessionError extends Error {
    constructor(message, ...params) {
        super(message);
        this.name = 'SessionError';
        this.message = message;
        if (params.length > 0) {
            this.message += ' ' + params.map((p) => JSON.stringify(p)).join(' ');
        }
    }
}
exports.SessionError = SessionError;
class SessionNotFoundError extends SessionError {
    constructor(sessionId) {
        super(`Session with ID ${sessionId} not found`, { sessionId });
        this.name = 'SessionNotFoundError';
    }
}
exports.SessionNotFoundError = SessionNotFoundError;
class SessionExpiredError extends SessionError {
    constructor(sessionId) {
        super(`Session with ID ${sessionId} has expired`, { sessionId });
        this.name = 'SessionExpiredError';
    }
}
exports.SessionExpiredError = SessionExpiredError;
class SessionInvalidError extends SessionError {
    constructor(reason, sessionId) {
        super(`Session is invalid: ${reason}`, { sessionId: sessionId });
        this.name = 'SessionInvalidError';
    }
}
exports.SessionInvalidError = SessionInvalidError;
