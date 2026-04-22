import type { PublishableNote } from '@core-domain/entities/publishable-note';

import { DetectWikilinksService } from '../../vault-parsing/services/detect-wikilinks.service';
import { ResolveWikilinksService } from '../../vault-parsing/services/resolve-wikilinks.service';
import { NoopLogger } from '../helpers/fake-logger';

describe('ResolveWikilinksService - aliases', () => {
  const logger = new NoopLogger();
  const detect = new DetectWikilinksService(logger);
  const service = new ResolveWikilinksService(logger, detect);

  it('resolves a real alias target like [[Luminara]] to the published page for Luminara (V)', () => {
    const sourceNote: PublishableNote = {
      noteId: 'source-note',
      title: 'Ouverture de la Toile',
      vaultPath: 'Ektaron/Evenements/Ouverture de la Toile.md',
      relativePath: 'Evenements/Ouverture de la Toile.md',
      content: 'Divinites creees : [[Luminara]].',
      frontmatter: { flat: {}, nested: {}, tags: [] },
      folderConfig: {
        id: 'folder-events',
        vaultFolder: 'Ektaron',
        routeBase: '/evenements',
        vpsId: 'vps',
        ignoredCleanupRuleIds: [],
      },
      publishedAt: new Date(),
      eligibility: { isPublishable: true },
      routing: {
        slug: 'ouverture-de-la-toile',
        path: '/evenements',
        routeBase: '/evenements',
        fullPath: '/evenements/ouverture-de-la-toile',
      },
    };

    const targetNote: PublishableNote = {
      noteId: 'luminara-note',
      title: 'Luminara (V)',
      vaultPath: 'Anorin Sirdalea/Amel Fass/Luminara (V)/Luminara (V).md',
      relativePath: 'Amel Fass/Luminara (V)/Luminara (V).md',
      content: '# Luminara (V)',
      frontmatter: {
        flat: { aliases: ['Luminara'] },
        nested: {},
        tags: [],
      },
      folderConfig: {
        id: 'folder-places',
        vaultFolder: 'Anorin Sirdalea',
        routeBase: '/anorin-sirdalea/amel-fass',
        vpsId: 'vps',
        ignoredCleanupRuleIds: [],
      },
      publishedAt: new Date(),
      eligibility: { isPublishable: true },
      routing: {
        slug: 'luminara-v',
        path: '/anorin-sirdalea/amel-fass',
        routeBase: '/anorin-sirdalea/amel-fass',
        fullPath: '/anorin-sirdalea/amel-fass/luminara-v',
      },
    };

    const [processed] = service.process([sourceNote, targetNote]);
    const link = processed.resolvedWikilinks?.[0];

    expect(link?.isResolved).toBe(true);
    expect(link?.targetNoteId).toBe('luminara-note');
    expect(link?.href).toBe('/anorin-sirdalea/amel-fass/luminara-v');
  });
});
