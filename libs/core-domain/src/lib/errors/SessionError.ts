export class SessionError extends Error {
  constructor(message: string, ...params: unknown[]) {
    super(message);
    this.name = 'SessionError';
    this.message = message;
    if (params.length > 0) {
      this.message += ' ' + params.map((p) => JSON.stringify(p)).join(' ');
    }
  }
}

export class SessionNotFoundError extends SessionError {
  constructor(sessionId: string) {
    super(`Session with ID ${sessionId} not found`, { sessionId });
    this.name = 'SessionNotFoundError';
  }
}

export class SessionExpiredError extends SessionError {
  constructor(sessionId: string) {
    super(`Session with ID ${sessionId} has expired`, { sessionId });
    this.name = 'SessionExpiredError';
  }
}

export class SessionInvalidError extends SessionError {
  constructor(reason: string, sessionId?: string) {
    super(`Session is invalid: ${reason}`, { sessionId });
    this.name = 'SessionInvalidError';
  }
}
