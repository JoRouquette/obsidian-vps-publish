import type { PublishableNote } from '@core-domain/entities/publishable-note';

import { ComputeRoutingService } from '../../vault-parsing/services/compute-routing.service';
import { NoopLogger } from '../helpers/fake-logger';

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
