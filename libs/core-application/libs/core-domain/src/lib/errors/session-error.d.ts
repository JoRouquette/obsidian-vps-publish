export declare class SessionError extends Error {
    constructor(message: string, ...params: unknown[]);
}
export declare class SessionNotFoundError extends SessionError {
    constructor(sessionId: string);
}
export declare class SessionExpiredError extends SessionError {
    constructor(sessionId: string);
}
export declare class SessionInvalidError extends SessionError {
    constructor(reason: string, sessionId?: string);
}
//# sourceMappingURL=session-error.d.ts.map