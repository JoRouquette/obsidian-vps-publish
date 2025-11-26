import { SessionRepository } from '../../../sessions/ports/session.repository';
import { Session, SessionStatus } from '@core-domain';

const mockSession: Session = {
  id: 'session-123',
  createdAt: new Date(),
  updatedAt: new Date(),
  status: 'active' as SessionStatus,
  notesPlanned: 10,
  assetsPlanned: 5,
  notesProcessed: 0,
  assetsProcessed: 0,
};

describe('SessionRepository', () => {
  let repository: SessionRepository;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
    };
  });

  it('should create a session', async () => {
    await repository.create(mockSession);
    expect(repository.create).toHaveBeenCalledWith(mockSession);
  });

  it('should find a session by id', async () => {
    (repository.findById as jest.Mock).mockResolvedValue(mockSession);
    const result = await repository.findById('session-123');
    expect(repository.findById).toHaveBeenCalledWith('session-123');
    expect(result).toBe(mockSession);
  });

  it('should return null if session not found', async () => {
    (repository.findById as jest.Mock).mockResolvedValue(null);
    const result = await repository.findById('not-found');
    expect(repository.findById).toHaveBeenCalledWith('not-found');
    expect(result).toBeNull();
  });

  it('should save a session', async () => {
    await repository.save(mockSession);
    expect(repository.save).toHaveBeenCalledWith(mockSession);
  });
});
