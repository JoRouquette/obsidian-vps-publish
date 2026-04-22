import type { PublishableNote } from '@core-domain/entities/publishable-note';

import { ContentSanitizerService } from '../../vault-parsing/services/content-sanitizer.service';
import { NoopLogger } from '../helpers/fake-logger';

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
    folderConfig: {
      id: 'f',
      vaultFolder: 'Vault',
      routeBase: '/blog',
      vpsId: 'vps',
      ignoredCleanupRuleIds: [],
    },
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

    expect(sanitized.content).not.toContain('publish: true');
    expect(sanitized.content).not.toContain('secret: keep');
    expect(sanitized.content).not.toContain('private');
    expect(sanitized.content.startsWith('---')).toBe(false);
    expect(sanitized.content.trim().startsWith('Body with')).toBe(true);
  });
});
