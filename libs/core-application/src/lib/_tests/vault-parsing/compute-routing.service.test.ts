import type { PublishableNote } from '@core-domain/entities/publishable-note';
import type { LoggerPort } from '@core-domain/ports/logger-port';

import { ComputeRoutingService } from '../../vault-parsing/services/compute-routing.service';

class NoopLogger implements LoggerPort {
  private _level: any = 0;
  set level(level: any) {
    this._level = level;
  }
  get level() {
    return this._level;
  }
  child(): LoggerPort {
    return this;
  }
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

describe('ComputeRoutingService', () => {
  const logger = new NoopLogger();
  const service = new ComputeRoutingService(logger);

  const baseNote = {
    noteId: '1',
    title: 'Note',
    vaultPath: 'Vault/Folder/Note.md',
    relativePath: 'Folder/Note.md',
    content: 'c',
    frontmatter: { flat: {}, nested: {}, tags: [] },
    folderConfig: {
      id: 'f',
      vaultFolder: 'Vault',
      routeBase: '/blog',
      vpsId: 'vps',
      ignoredCleanupRuleIds: [],
    },
    publishedAt: new Date(),
    eligibility: { isPublishable: true },
    routing: { slug: '', path: '', routeBase: '', fullPath: '' },
  } as PublishableNote;

  it('computes slug/path/fullPath with nested folders', () => {
    const [note] = service.process([baseNote]);
    expect(note.routing.slug).toBe('note');
    expect(note.routing.path).toBe('folder');
    expect(note.routing.fullPath).toBe('/blog/folder/note');
  });

  it('handles root path gracefully', () => {
    const clone = { ...baseNote, relativePath: 'Note.md' };
    const [note] = service.process([clone]);
    expect(note.routing.path).toBe('');
    expect(note.routing.fullPath).toBe('/blog/note');
  });
});
