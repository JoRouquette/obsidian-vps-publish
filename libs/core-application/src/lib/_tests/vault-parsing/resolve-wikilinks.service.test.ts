import { ResolveWikilinksService } from '../../vault-parsing/services/resolve-wikilinks.service';
import { DetectWikilinksService } from '../../vault-parsing/services/detect-wikilinks.service';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import type { PublishableNote } from '@core-domain/entities/publishable-note';

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

describe('ResolveWikilinksService', () => {
  const logger = new NoopLogger();
  const detect = new DetectWikilinksService(logger);
  const service = new ResolveWikilinksService(logger, detect);

  const baseNote = {
    noteId: '1',
    title: 'A',
    vaultPath: 'Vault/A.md',
    relativePath: 'A.md',
    content: 'Link to [[B.md]]',
    frontmatter: { flat: {}, nested: {}, tags: [] },
    folderConfig: { id: 'f', vaultFolder: 'Vault', routeBase: '/blog', vpsId: 'vps' },
    vpsConfig: { id: 'vps', name: 'v', url: 'http://x', apiKey: 'k' },
    publishedAt: new Date(),
    eligibility: { isPublishable: true },
    routing: { slug: '', path: '', routeBase: '', fullPath: '' },
  } as PublishableNote;

  const targetNote = {
    ...baseNote,
    noteId: '2',
    title: 'B',
    content: 'Content',
    relativePath: 'B.md',
    vaultPath: 'Vault/B.md',
  };

  it('marks wikilinks as resolved when target exists', () => {
    const [note] = service.process([baseNote, targetNote]);
    expect(note.resolvedWikilinks?.[0].isResolved).toBe(true);
    expect(note.resolvedWikilinks?.[0].targetNoteId).toBe('2');
  });

  it('marks wikilinks as unresolved when target missing', () => {
    const [note] = service.process([baseNote]);
    expect(note.resolvedWikilinks?.[0].isResolved).toBe(false);
  });
});
