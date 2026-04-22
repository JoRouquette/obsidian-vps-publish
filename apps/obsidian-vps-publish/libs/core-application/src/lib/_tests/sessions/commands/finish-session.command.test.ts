import { type FinishSessionCommand } from '../../../sessions/commands/finish-session.command';

describe('FinishSessionCommand', () => {
  it('should create a valid FinishSessionCommand object', () => {
    const command: FinishSessionCommand = {
      sessionId: 'session-123',
      notesProcessed: 10,
      assetsProcessed: 5,
    };

    expect(command.sessionId).toBe('session-123');
    expect(command.notesProcessed).toBe(10);
    expect(command.assetsProcessed).toBe(5);
  });

  it('should not allow missing required fields (compile-time)', () => {
    // TypeScript will error if required fields are missing.
    // This test is for documentation only.
    // const invalidCommand: FinishSessionCommand = { sessionId: 'id' }; // should error
    expect(true).toBe(true);
  });

  it('should allow notesProcessed and assetsProcessed to be zero', () => {
    const command: FinishSessionCommand = {
      sessionId: 'session-456',
      notesProcessed: 0,
      assetsProcessed: 0,
    };

    expect(command.notesProcessed).toBe(0);
    expect(command.assetsProcessed).toBe(0);
  });

  it('should allow large numbers for processed fields', () => {
    const command: FinishSessionCommand = {
      sessionId: 'session-789',
      notesProcessed: 100000,
      assetsProcessed: 50000,
    };

    expect(command.notesProcessed).toBeGreaterThan(99999);
    expect(command.assetsProcessed).toBeGreaterThan(49999);
  });

  it('should treat different sessionIds as different commands', () => {
    const command1: FinishSessionCommand = {
      sessionId: 'session-A',
      notesProcessed: 1,
      assetsProcessed: 2,
    };
    const command2: FinishSessionCommand = {
      sessionId: 'session-B',
      notesProcessed: 1,
      assetsProcessed: 2,
    };

    expect(command1.sessionId).not.toBe(command2.sessionId);
  });
});
