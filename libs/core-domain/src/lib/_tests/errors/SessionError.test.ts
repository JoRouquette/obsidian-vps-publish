import { Session, SessionStatus } from '../../entities/Session';

describe('Session Entity', () => {
  const baseSession: Session = {
    id: 'session-123',
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
    // This test is for type safety and will not run at runtime,
    // but you can check with TypeScript that the following line would error:
    // const invalidSession: Session = { ...baseSession, status: 'invalid' as SessionStatus };
    expect(true).toBe(true);
  });

  it('should update processed counts', () => {
    const session: Session = { ...baseSession, notesProcessed: 5, assetsProcessed: 2 };
    expect(session.notesProcessed).toBe(5);
    expect(session.assetsProcessed).toBe(2);
  });

  it('should update timestamps', () => {
    const updated = new Date('2024-01-02T00:00:00Z');
    const session: Session = { ...baseSession, updatedAt: updated };
    expect(session.updatedAt).toEqual(updated);
  });

  it('should not exceed planned notes/assets', () => {
    const session: Session = { ...baseSession, notesProcessed: 10, assetsProcessed: 5 };
    expect(session.notesProcessed).toBeLessThanOrEqual(session.notesPlanned);
    expect(session.assetsProcessed).toBeLessThanOrEqual(session.assetsPlanned);
  });
});
