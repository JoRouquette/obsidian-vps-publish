import { FinishSessionResult } from '../../../sessions/commands/finish-session.result';

describe('FinishSessionResult', () => {
  it('should have required properties', () => {
    const result: FinishSessionResult = {
      sessionId: 'abc123',
      success: true,
    };

    expect(result).toHaveProperty('sessionId');
    expect(result).toHaveProperty('success');
  });

  it('should accept a string sessionId', () => {
    const result: FinishSessionResult = {
      sessionId: 'session-001',
      success: false,
    };

    expect(typeof result.sessionId).toBe('string');
    expect(result.sessionId).toBe('session-001');
  });

  it('should accept a boolean success', () => {
    const resultTrue: FinishSessionResult = {
      sessionId: 's1',
      success: true,
    };
    const resultFalse: FinishSessionResult = {
      sessionId: 's2',
      success: false,
    };

    expect(typeof resultTrue.success).toBe('boolean');
    expect(resultTrue.success).toBe(true);
    expect(resultFalse.success).toBe(false);
  });

  it('should only contain sessionId and success', () => {
    const result: FinishSessionResult = {
      sessionId: 's3',
      success: true,
    };

    expect(result).toEqual({ sessionId: 's3', success: true });
  });
});
