import { AbortSessionResult } from '../../../sessions/commands/AbortSessionResult';

describe('AbortSessionResult', () => {
  it('should have a valid sessionId and success true', () => {
    const result: AbortSessionResult = {
      sessionId: 'session-123',
      success: true,
    };
    expect(result.sessionId).toBe('session-123');
    expect(result.success).toBe(true);
  });

  it('should have a valid sessionId and success false', () => {
    const result: AbortSessionResult = {
      sessionId: 'session-456',
      success: false,
    };
    expect(result.sessionId).toBe('session-456');
    expect(result.success).toBe(false);
  });

  it('should not accept missing sessionId', () => {
    // @ts-expect-error
    const result: AbortSessionResult = {
      success: true,
    };
    expect(result).toBeDefined();
  });

  it('should not accept missing success', () => {
    // @ts-expect-error
    const result: AbortSessionResult = {
      sessionId: 'session-789',
    };
    expect(result).toBeDefined();
  });

  it('should not accept extra properties', () => {
    const result: AbortSessionResult = {
      sessionId: 'session-999',
      success: true,
      // @ts-expect-error
      extraProp: 'not-allowed',
    };
    expect(result).toBeDefined();
  });
});
