import { AbortSessionCommand } from '../../../sessions/commands/AbortSessionCommand';

describe('AbortSessionCommand', () => {
  it('should have a sessionId property of type string', () => {
    const command: AbortSessionCommand = { sessionId: 'abc123' };
    expect(typeof command.sessionId).toBe('string');
    expect(command.sessionId).toBe('abc123');
  });

  it('should not accept missing sessionId', () => {
    // @ts-expect-error
    const invalidCommand: AbortSessionCommand = {};
    expect(invalidCommand.sessionId).toBeUndefined();
  });

  it('should not accept non-string sessionId', () => {
    // @ts-expect-error
    const invalidCommand: AbortSessionCommand = { sessionId: 123 };
    expect(typeof invalidCommand.sessionId).not.toBe('string');
  });
});
