import { promises as fs } from 'node:fs';
import path from 'node:path';

import { LoggerPort, SessionNotesStoragePort } from '@core-application';
import { PublishableNote } from '@core-domain';

export class SessionNotesFileStorage implements SessionNotesStoragePort {
  constructor(
    private readonly contentRoot: string,
    private readonly logger?: LoggerPort
  ) {}

  private notesDir(sessionId: string): string {
    return path.join(this.contentRoot, '.staging', sessionId, '_raw-notes');
  }

  async append(sessionId: string, notes: PublishableNote[]): Promise<void> {
    if (!notes.length) return;

    const dir = this.notesDir(sessionId);
    await fs.mkdir(dir, { recursive: true });

    for (const note of notes) {
      const filePath = path.join(dir, `${note.noteId}.json`);
      const serializable = {
        ...note,
        publishedAt: note.publishedAt?.toISOString?.() ?? null,
      };
      await fs.writeFile(filePath, JSON.stringify(serializable, null, 2), 'utf8');
    }

    this.logger?.debug('Persisted raw notes for session', {
      sessionId,
      count: notes.length,
      dir,
    });
  }

  async loadAll(sessionId: string): Promise<PublishableNote[]> {
    const dir = this.notesDir(sessionId);

    try {
      const entries = await fs.readdir(dir);
      const notes: PublishableNote[] = [];

      for (const entry of entries) {
        if (!entry.endsWith('.json')) continue;
        const raw = await fs.readFile(path.join(dir, entry), 'utf8');
        const parsed = JSON.parse(raw);
        notes.push({
          ...parsed,
          publishedAt: parsed.publishedAt ? new Date(parsed.publishedAt) : new Date(),
        });
      }

      this.logger?.debug('Loaded raw notes for session', {
        sessionId,
        count: notes.length,
        dir,
      });

      return notes;
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        this.logger?.warn('No raw notes found for session', { sessionId, dir });
        return [];
      }

      this.logger?.error('Failed to load raw notes', { sessionId, dir, error: err });
      throw err;
    }
  }

  async clear(sessionId: string): Promise<void> {
    const dir = this.notesDir(sessionId);
    await fs.rm(dir, { recursive: true, force: true });
    this.logger?.debug('Cleared raw notes storage', { sessionId, dir });
  }
}
