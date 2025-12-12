import { promises as fs } from 'node:fs';
import path from 'node:path';

import { type LoggerPort, type SessionNotesStoragePort } from '@core-application';
import { type PublishableNote, type SanitizationRules } from '@core-domain';

export class SessionNotesFileStorage implements SessionNotesStoragePort {
  constructor(
    private readonly contentRoot: string,
    private readonly logger?: LoggerPort
  ) {}

  private notesDir(sessionId: string): string {
    return path.join(this.contentRoot, '.staging', sessionId, '_raw-notes');
  }

  private cleanupRulesPath(sessionId: string): string {
    return path.join(this.contentRoot, '.staging', sessionId, '_cleanup-rules.json');
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
    } catch (err: unknown) {
      const code = (err as { code?: string } | undefined)?.code;
      if (code === 'ENOENT') {
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

  async saveCleanupRules(sessionId: string, rules: SanitizationRules[]): Promise<void> {
    const filePath = this.cleanupRulesPath(sessionId);
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(rules, null, 2), 'utf8');
    this.logger?.debug('Saved cleanup rules for session', {
      sessionId,
      count: rules.length,
      filePath,
    });
  }

  async loadCleanupRules(sessionId: string): Promise<SanitizationRules[]> {
    const filePath = this.cleanupRulesPath(sessionId);
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const rules = JSON.parse(raw) as SanitizationRules[];
      this.logger?.debug('Loaded cleanup rules for session', {
        sessionId,
        count: rules.length,
        filePath,
      });
      return rules;
    } catch (err: unknown) {
      const code = (err as { code?: string } | undefined)?.code;
      if (code === 'ENOENT') {
        this.logger?.warn('No cleanup rules found for session', { sessionId, filePath });
        return [];
      }
      this.logger?.error('Failed to load cleanup rules', { sessionId, filePath, error: err });
      throw err;
    }
  }
}
