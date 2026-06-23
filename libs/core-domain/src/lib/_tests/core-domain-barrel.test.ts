import * as CoreDomain from '../core-domain';
import type { Session } from '../entities/session';
import { SessionError } from '../errors/session-error';

describe('core-domain barrel', () => {
  it('expose les entités et erreurs principales sans planter', () => {
    expect(CoreDomain).toBeDefined();
    expect(CoreDomain.SessionError).toBe(SessionError);

    const session: Session = {
      id: 's1',
      notesPlanned: 0,
      assetsPlanned: 0,
      notesProcessed: 0,
      assetsProcessed: 0,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(session.id).toBe('s1');
  });
});
