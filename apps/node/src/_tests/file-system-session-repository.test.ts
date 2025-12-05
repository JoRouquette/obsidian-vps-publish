import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { type Session, SessionNotFoundError, type SessionStatus } from '@core-domain';

import { FileSystemSessionRepository } from '../infra/filesystem/file-system-session.repository';

describe('FileSystemSessionRepository', () => {
  let tmpDir: string;
  let repository: FileSystemSessionRepository;

  const baseSession: Session = {
    id: 'session-1',
    notesPlanned: 1,
    assetsPlanned: 1,
    notesProcessed: 0,
    assetsProcessed: 0,
    status: 'active' as SessionStatus,
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sessions-'));
    repository = new FileSystemSessionRepository(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates and finds a session round-trip with dates', async () => {
    await repository.create(baseSession);

    const found = await repository.findById(baseSession.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(baseSession.id);
    expect(found?.createdAt).toBeInstanceOf(Date);
    expect(found?.updatedAt).toBeInstanceOf(Date);
  });

  it('returns null when session file does not exist', async () => {
    const found = await repository.findById('missing');
    expect(found).toBeNull();
  });

  it('saves changes to an existing session', async () => {
    await repository.create(baseSession);
    const updated: Session = {
      ...baseSession,
      status: 'finished' as SessionStatus,
      updatedAt: new Date('2023-01-02T00:00:00Z'),
    };

    await repository.save(updated);

    const found = await repository.findById(baseSession.id);
    expect(found?.status).toBe('finished');
    expect(found?.updatedAt.getTime()).toBe(new Date('2023-01-02T00:00:00Z').getTime());
  });

  it('throws SessionNotFoundError when saving a missing session', async () => {
    await expect(repository.save(baseSession)).rejects.toBeInstanceOf(SessionNotFoundError);
  });

  it('throws when creating an existing session file', async () => {
    await repository.create(baseSession);
    await expect(repository.create(baseSession)).rejects.toBeDefined();
  });
});
