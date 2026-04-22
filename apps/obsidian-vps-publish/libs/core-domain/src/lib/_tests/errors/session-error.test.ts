import {
  SessionError,
  SessionNotFoundError,
  SessionExpiredError,
  SessionInvalidError,
} from '../../errors/session-error';

describe('SessionError', () => {
  it('should set name and message', () => {
    const err = new SessionError('Test message');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('SessionError');
    expect(err.message).toBe('Test message');
  });

  it('should append params to message', () => {
    const err = new SessionError('Base', { foo: 'bar' }, 42);
    expect(err.message).toContain('Base');
    expect(err.message).toContain(JSON.stringify({ foo: 'bar' }));
    expect(err.message).toContain('42');
  });
});

describe('SessionNotFoundError', () => {
  it('should set name and message with sessionId', () => {
    const err = new SessionNotFoundError('abc123');
    expect(err).toBeInstanceOf(SessionError);
    expect(err.name).toBe('SessionNotFoundError');
    expect(err.message).toContain('Session with ID abc123 not found');
    expect(err.message).toContain('"sessionId":"abc123"');
  });
});

describe('SessionExpiredError', () => {
  it('should set name and message with sessionId', () => {
    const err = new SessionExpiredError('xyz789');
    expect(err).toBeInstanceOf(SessionError);
    expect(err.name).toBe('SessionExpiredError');
    expect(err.message).toContain('Session with ID xyz789 has expired');
    expect(err.message).toContain('"sessionId":"xyz789"');
  });
});

describe('SessionInvalidError', () => {
  it('should set name and message with reason and sessionId', () => {
    const err = new SessionInvalidError('token mismatch', 'sess42');
    expect(err).toBeInstanceOf(SessionError);
    expect(err.name).toBe('SessionInvalidError');
    expect(err.message).toContain('Session is invalid: token mismatch');
    expect(err.message).toContain('"sessionId":"sess42"');
  });

  it('should handle missing sessionId', () => {
    const err = new SessionInvalidError('missing id');
    expect(err).toBeInstanceOf(SessionError);
    expect(err.message).toContain('Session is invalid: missing id');
    expect(err.message).toContain('{}');
  });
});
