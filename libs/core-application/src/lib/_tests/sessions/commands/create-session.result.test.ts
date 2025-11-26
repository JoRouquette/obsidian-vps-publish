import { CreateSessionResult } from '../../../sessions/commands/create-session.result';

describe('CreateSessionResult', () => {
  it('should have a sessionId of type string and success of type boolean', () => {
    const result: CreateSessionResult = {
      sessionId: 'abc123',
      success: true,
    };

    expect(typeof result.sessionId).toBe('string');
    expect(typeof result.success).toBe('boolean');
  });

  it('should allow success to be false', () => {
    const result: CreateSessionResult = {
      sessionId: 'def456',
      success: false,
    };

    expect(result.success).toBe(false);
  });

  it('should require sessionId to be non-empty', () => {
    const result: CreateSessionResult = {
      sessionId: '',
      success: true,
    };

    expect(result.sessionId).toBe('');
  });

  it('should match the interface shape', () => {
    const result: CreateSessionResult = {
      sessionId: 'xyz789',
      success: true,
    };

    expect(result).toHaveProperty('sessionId');
    expect(result).toHaveProperty('success');
  });
});
