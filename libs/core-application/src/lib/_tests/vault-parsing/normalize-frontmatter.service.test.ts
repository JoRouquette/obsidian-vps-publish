import { NormalizeFrontmatterService } from '../../vault-parsing/services/normalize-frontmatter.service';
import type { CollectedNote } from '@core-domain/entities';
import type { LoggerPort } from '@core-domain/ports/logger-port';

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

  const baseNote: Omit<CollectedNote, 'frontmatter'> = {
    noteId: 'note-id',
    title: 'Note',
    vaultPath: 'Vault/Note.md',
    relativePath: 'Note.md',
    content: '',
    folderConfig: {
      id: 'folder',
      vaultFolder: 'Vault',
      routeBase: '/',
      vpsId: 'vps',
    },
  };

  it('normalizes a DomainFrontmatter payload by using its flat raw frontmatter', () => {
    const [normalized] = service.process([
      {
        ...baseNote,
        frontmatter: {
          flat: {
            Publish: false,
            'dg-publish': true,
            'section.done': 'yes',
            tags: ['a', 'b'],
          },
          nested: {},
          tags: ['outdated'],
        } as any,
      },
    ]);

    expect(normalized.frontmatter.flat.publish).toBe(false);
    expect(normalized.frontmatter.flat.dgpublish).toBe(true);
    expect((normalized.frontmatter.nested as any).publish).toBe(false);
    expect((normalized.frontmatter.nested as any).dgpublish).toBe(true);
    expect((normalized.frontmatter.nested as any).section.done).toBe('yes');
    expect(normalized.frontmatter.tags).toEqual(['a', 'b']);
  });
});
