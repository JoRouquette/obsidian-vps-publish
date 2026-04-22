import type { PublishableNote } from '@core-domain/entities/publishable-note';

import { DetectWikilinksService } from '../../vault-parsing/services/detect-wikilinks.service';
import { ResolveWikilinksService } from '../../vault-parsing/services/resolve-wikilinks.service';
import { NoopLogger } from '../helpers/fake-logger';

describe('ResolveWikilinksService - Real World: Sens et capacités#Vision thermique', () => {
  const logger = new NoopLogger();
  const detect = new DetectWikilinksService(logger);
  const service = new ResolveWikilinksService(logger, detect);

  it('REPRO: should resolve wikilink to "Sens et capacités#Vision thermique"', () => {
    // Note source : Masque de tacticien basique
    const sourceNote: PublishableNote = {
      noteId: 'masque-id',
      title: 'Masque de tacticien basique',
      vaultPath: '_Trésors/Objets Magiques/Objet merveilleux/Masque de tacticien basique.md',
      relativePath: 'Objets Magiques/Objet merveilleux/Masque de tacticien basique.md',
      content:
        'vous pouvez dépenser 3 charges pour activer la [[Sens et capacités#Vision thermique|vision thermique]] sur 18 mètres',
      frontmatter: { flat: {}, nested: {}, tags: [] },
      folderConfig: {
        id: 'f-tresors',
        vaultFolder: '_Trésors',
        routeBase: '/objets-magiques',
        vpsId: 'vps',
        ignoredCleanupRuleIds: [],
      },
      publishedAt: new Date(),
      eligibility: { isPublishable: true },
      routing: {
        slug: 'masque-de-tacticien-basique',
        path: '/objets-magiques/objet-merveilleux',
        routeBase: '/objets-magiques',
        fullPath: '/objets-magiques/objet-merveilleux/masque-de-tacticien-basique',
      },
    };

    // Note cible : Sens et capacités
    const targetNote: PublishableNote = {
      noteId: 'sens-capacites-id',
      title: 'Sens et capacités',
      vaultPath: '_Mecaniques/Homebrew/Règles/Sens et capacités.md',
      relativePath: 'Homebrew/Règles/Sens et capacités.md',
      content: '### Vision thermique\n\nLa créature perçoit...',
      frontmatter: {
        flat: { type: 'Mécanique', sous_type: 'règle' },
        nested: {},
        tags: [],
      },
      folderConfig: {
        id: 'f-mecaniques',
        vaultFolder: '_Mecaniques',
        routeBase: '/regles-de-la-table',
        vpsId: 'vps',
        ignoredCleanupRuleIds: [],
      },
      publishedAt: new Date(),
      eligibility: { isPublishable: true },
      routing: {
        slug: 'sens-et-capacites',
        path: '/regles-de-la-table',
        routeBase: '/regles-de-la-table',
        fullPath: '/regles-de-la-table/sens-et-capacites',
      },
    };

    // Process
    const [processed] = service.process([sourceNote, targetNote]);

    // Assertions
    console.log('Resolved wikilinks:', JSON.stringify(processed.resolvedWikilinks, null, 2));

    expect(processed.resolvedWikilinks).toBeDefined();
    expect(processed.resolvedWikilinks).toHaveLength(1);

    const link = processed.resolvedWikilinks![0];
    console.log('Link details:', {
      target: link.target,
      path: link.path,
      subpath: link.subpath,
      alias: link.alias,
      isResolved: link.isResolved,
      href: link.href,
      targetNoteId: link.targetNoteId,
    });

    // EXPECTATION: Le lien DOIT être résolu
    expect(link.isResolved).toBe(true);
    expect(link.targetNoteId).toBe('sens-capacites-id');
    expect(link.href).toContain('/regles-de-la-table/sens-et-capacites');
    expect(link.href).toContain('#Vision thermique'); // Subpath non slugifié dans le resolver
  });
});
