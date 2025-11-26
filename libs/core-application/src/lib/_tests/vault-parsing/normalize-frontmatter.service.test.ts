import { NormalizeFrontmatterService } from '../../vault-parsing/services/normalize-frontmatter.service';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import type { CollectedNote } from '@core-domain/entities/collected-note';

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

describe('NormalizeFrontmatterService', () => {
  const logger = new NoopLogger();
  const service = new NormalizeFrontmatterService(logger);

  const baseNote: CollectedNote = {
    noteId: '1',
    title: 'Note',
    vaultPath: 'Vault/Note.md',
    relativePath: 'Note.md',
    content: 'c',
    frontmatter: { 'Foo.Bar': 'baz', tags: ['a', 'b'], nested: { keep: true } } as any,
    folderConfig: { id: 'f', vaultFolder: 'Vault', routeBase: '/blog', vpsId: 'vps' },
    vpsConfig: { id: 'vps', name: 'v', url: 'http://x', apiKey: 'k' },
  };

  it('normalizes keys and builds flat/nested/tags', () => {
    const [note] = service.process([baseNote]);
    expect(note.frontmatter.flat['foobar']).toBe('baz');
    expect((note.frontmatter.nested as any).foobar).toBe('baz');
    expect(note.frontmatter.tags).toEqual(['a', 'b']);
  });

  it('handles missing frontmatter', () => {
    const clone = { ...baseNote, frontmatter: undefined as any };
    const [note] = service.process([clone]);
    expect(note.frontmatter.flat).toEqual({});
    expect(note.frontmatter.tags).toEqual([]);
  });
});
