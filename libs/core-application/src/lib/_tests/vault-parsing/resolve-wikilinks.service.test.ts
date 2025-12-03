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
    expect(note.resolvedWikilinks?.[0].origin).toBe('content');
  });

  it('marks wikilinks as unresolved when target missing', () => {
    const [note] = service.process([baseNote]);
    expect(note.resolvedWikilinks?.[0].isResolved).toBe(false);
  });

  it('detects frontmatter wikilinks and keeps their origin', () => {
    const withFrontmatter: PublishableNote = {
      ...baseNote,
      content: 'nothing to see here',
      frontmatter: { flat: {}, nested: { related: '[[B.md]]' }, tags: [] },
    };

    const [note] = service.process([withFrontmatter, targetNote]);
    expect(note.resolvedWikilinks?.[0].origin).toBe('frontmatter');
    expect(note.resolvedWikilinks?.[0].frontmatterPath).toBe('related');
    expect(note.resolvedWikilinks?.[0].isResolved).toBe(true);
  });
});
