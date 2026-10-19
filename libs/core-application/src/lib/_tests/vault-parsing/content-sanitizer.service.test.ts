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

  it('removes excluded keys held by objects inside arrays and keeps non-plain values', () => {
    const service = new ContentSanitizerService([], ['secret'], [], logger);
    const created = new Date('2026-01-02T00:00:00Z');

    const note: PublishableNote = {
      ...baseNote,
      content: 'Body',
      frontmatter: {
        flat: {},
        nested: { items: [{ a: 1, secret: 'x' }, 'b'], created },
        tags: [],
      },
    };
    const [sanitized] = service.process([note]);

    expect(sanitized.frontmatter.nested['items']).toEqual([{ a: 1 }, 'b']);
    expect(sanitized.frontmatter.nested['created']).toBe(created);
  });

  it('cleans arrays nested in arrays and keeps an emptied object in its list', () => {
    const service = new ContentSanitizerService([], ['secret', 'deep.secret'], [], logger);

    const note: PublishableNote = {
      ...baseNote,
      content: 'Body',
      frontmatter: {
        flat: {},
        nested: {
          matrix: [[{ secret: 'x', ok: 1 }], [{ secret: 'y' }]],
          deep: [[{ secret: 'z', keep: true }]],
        },
        tags: [],
      },
    };
    const [sanitized] = service.process([note]);

    // An object emptied inside a list stays in place ({}): the list keeps its length and order.
    expect(sanitized.frontmatter.nested['matrix']).toEqual([[{ ok: 1 }], [{}]]);
    expect(sanitized.frontmatter.nested['deep']).toEqual([[{ keep: true }]]);
  });

  it('applies a dotted exclusion path through a list of objects', () => {
    const service = new ContentSanitizerService([], ['meta.secret'], [], logger);

    const note: PublishableNote = {
      ...baseNote,
      content: 'Body',
      frontmatter: {
        flat: {},
        nested: { meta: [{ secret: 'x', ok: 1 }] },
        tags: [],
      },
    };
    const [sanitized] = service.process([note]);

    expect(sanitized.frontmatter.nested['meta']).toEqual([{ ok: 1 }]);
  });
});
