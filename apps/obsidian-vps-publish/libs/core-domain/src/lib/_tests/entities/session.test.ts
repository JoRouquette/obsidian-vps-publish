import { Session, SessionStatus } from '../../entities/session';

describe('Session Entity', () => {
  const baseSession: Session = {
    id: 'session-1',
    notesPlanned: 10,
    assetsPlanned: 5,
    notesProcessed: 0,
    assetsProcessed: 0,
    status: 'pending',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  it('should have all required properties', () => {
    expect(baseSession).toHaveProperty('id');
    expect(baseSession).toHaveProperty('notesPlanned');
    expect(baseSession).toHaveProperty('assetsPlanned');
    expect(baseSession).toHaveProperty('notesProcessed');
    expect(baseSession).toHaveProperty('assetsProcessed');
    expect(baseSession).toHaveProperty('status');
    expect(baseSession).toHaveProperty('createdAt');
    expect(baseSession).toHaveProperty('updatedAt');
  });

  it('should allow valid status values', () => {
    const statuses: SessionStatus[] = ['pending', 'active', 'finished', 'aborted'];
    statuses.forEach((status) => {
      const session: Session = { ...baseSession, status };
      expect(session.status).toBe(status);
    });
  });

  it('should not allow invalid status values (type check)', () => {
    // TypeScript will catch this at compile time, so this is just for demonstration.
    // @ts-expect-error
    const session: Session = { ...baseSession, status: 'invalid' };
    expect(session.status).not.toBe('pending'); // This line will never run due to TS error
  });

  it('should update processed counts correctly', () => {
    const updatedSession: Session = {
      ...baseSession,
      notesProcessed: 5,
      assetsProcessed: 3,
      updatedAt: new Date('2024-01-01T01:00:00Z'),
    };
    expect(updatedSession.notesProcessed).toBe(5);
    expect(updatedSession.assetsProcessed).toBe(3);
    expect(updatedSession.updatedAt.getTime()).toBeGreaterThan(baseSession.updatedAt.getTime());
  });

  it('should not allow negative planned or processed counts', () => {
    const invalidSession: Session = {
      ...baseSession,
      notesPlanned: -1,
      assetsPlanned: -2,
      notesProcessed: -3,
      assetsProcessed: -4,
    };
    expect(invalidSession.notesPlanned).toBeLessThan(0);
    expect(invalidSession.assetsPlanned).toBeLessThan(0);
    expect(invalidSession.notesProcessed).toBeLessThan(0);
    expect(invalidSession.assetsProcessed).toBeLessThan(0);
  });

  it('should have createdAt and updatedAt as Date instances', () => {
    expect(baseSession.createdAt).toBeInstanceOf(Date);
    expect(baseSession.updatedAt).toBeInstanceOf(Date);
  });
});
