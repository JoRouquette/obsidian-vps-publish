import type { CollectedNote } from '@core-domain/entities';

import { NormalizeFrontmatterService } from '../../vault-parsing/services/normalize-frontmatter.service';
import { NoopLogger } from '../helpers/fake-logger';

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
      ignoredCleanupRuleIds: [],
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
            'effet-secondaire': 'one',
            effetSecondaire: 'two',
            type_creature: 'dragon',
            'type-creature': 'gobelin',
            tags: ['a', 'b'],
          },
          nested: {},
          tags: ['outdated'],
        } as any,
      },
    ]);

    expect(normalized.frontmatter.flat.publish).toBe(false);
    expect(normalized.frontmatter.flat.dgPublish).toBe(true);
    expect((normalized.frontmatter.nested as any).publish).toBe(false);
    expect((normalized.frontmatter.nested as any).dgPublish).toBe(true);
    expect((normalized.frontmatter.nested as any).section.done).toBe('yes');
    expect(normalized.frontmatter.flat.effetSecondaire).toBe('two');
    expect(normalized.frontmatter.flat.typeCreature).toBe('gobelin');
    expect((normalized.frontmatter.nested as any).effetSecondaire).toBe('two');
    expect((normalized.frontmatter.nested as any).typeCreature).toBe('gobelin');
    expect(normalized.frontmatter.tags).toEqual(['a', 'b']);
  });
});
