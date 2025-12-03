import { ContentSanitizerService } from '../../vault-parsing/services/content-sanitizer.service';
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

describe('ContentSanitizerService', () => {
  const logger = new NoopLogger();

  const baseNote: PublishableNote = {
    noteId: 'note-1',
    title: 'Note',
    vaultPath: 'Vault/Note.md',
    relativePath: 'Note.md',
    content: `---
publish: true
secret: keep
tags:
  - public
  - private
---

Body with ![[img.png]]`,
    frontmatter: {
      flat: { publish: true, secret: 'keep', tags: ['public', 'private'] },
      nested: { publish: true, secret: 'keep', tags: ['public', 'private'] },
      tags: ['public', 'private'],
    },
    folderConfig: { id: 'f', vaultFolder: 'Vault', routeBase: '/blog', vpsId: 'vps' },
    vpsConfig: { id: 'vps', name: 'v', url: 'http://x', apiKey: 'k' },
    routing: { slug: '', path: '', routeBase: '', fullPath: '' },
    publishedAt: new Date(),
    eligibility: { isPublishable: true },
  };

  it('removes excluded frontmatter keys, strips tags and rewrites frontmatter in markdown', () => {
    const service = new ContentSanitizerService([], ['secret'], ['private'], logger);

    const clone = JSON.parse(JSON.stringify(baseNote));
    clone.publishedAt = new Date(clone.publishedAt);
    const [sanitized] = service.process([clone]);

    expect(sanitized.frontmatter.flat.secret).toBeUndefined();
    expect((sanitized.frontmatter.nested as any).secret).toBeUndefined();
    expect(sanitized.frontmatter.tags).toEqual(['public']);

    expect(sanitized.content).toContain('publish: true');
    expect(sanitized.content).not.toContain('secret: keep');
    expect(sanitized.content).not.toContain('private');
    expect(sanitized.content.startsWith('---')).toBe(true);
  });
});
