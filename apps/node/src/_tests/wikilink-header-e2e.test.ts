/**
 * Test E2E pour le bug wikilink avec header – [[Sens et capacités#Vision thermique|vision thermique]]
 *
 * Reproduit le pipeline complet: ResolvedWikilink → renderWikilink → cleanAndNormalizeLinks → HTML final
 *
 * FACTS vérif\u00e9s :
 * - Note source: test-vault/_Tr\u00e9sors/Objets Magiques/Objet merveilleux/Masque de tacticien basique.md (ligne 36)
 * - Wikilink: [[Sens et capacit\u00e9s#Vision thermique|vision thermique]]
 * - Backend r\u00e9sout le lien avec href="/regles-de-la-table/sens-et-capacites" + subpath slugifi\u00e9
 * - cleanAndNormalizeLinks NE DOIT PAS invalider ce lien
 */

import { type PublishableNote } from '@core-domain';
import { describe, expect, it } from '@jest/globals';

import { MarkdownItRenderer } from '../infra/markdown/markdown-it.renderer';

describe('E2E: Wikilink avec header', () => {
  let renderer: MarkdownItRenderer;

  beforeEach(() => {
    renderer = new MarkdownItRenderer();
  });

  it('SHOULD preserve backend-resolved wikilink with header through full render() pipeline', async () => {
    // Note contenant un wikilink r\u00e9solu par le backend avec href + subpath
    const note: PublishableNote = {
      noteId: 'test-note',
      title: 'Masque de tacticien basique',
      vaultPath: '_Tr\u00e9sors/Objets Magiques/Objet merveilleux/Masque de tacticien basique.md',
      relativePath:
        '_Tr\u00e9sors/Objets Magiques/Objet merveilleux/Masque de tacticien basique.md',
      content:
        'Vous pouvez activer la [[Sens et capacit\u00e9s#Vision thermique|vision thermique]] sur 18 m\u00e8tres.',
      frontmatter: {
        flat: {},
        nested: {},
        tags: [],
      },
      folderConfig: {
        id: 'folder-1',
        vaultFolder: '_Tr\u00e9sors',
        routeBase: '/tresors',
        vpsId: 'vps-1',
        ignoredCleanupRuleIds: [],
      },
      routing: {
        slug: 'masque-de-tacticien-basique',
        path: '/tresors/objets-magiques/objet-merveilleux',
        fullPath: '/tresors/objets-magiques/objet-merveilleux/masque-de-tacticien-basique',
        routeBase: '/tresors',
      },
      eligibility: {
        isPublishable: true,
      },
      publishedAt: new Date(),
      resolvedWikilinks: [
        {
          raw: '[[Sens et capacit\u00e9s#Vision thermique|vision thermique]]',
          target: 'Sens et capacit\u00e9s',
          path: '_Mecaniques/Homebrew/R\u00e8gles/Sens et capacit\u00e9s',
          subpath: 'Vision thermique',
          alias: 'vision thermique',
          kind: 'note',
          isResolved: true,
          href: '/regles-de-la-table/sens-et-capacites',
          origin: 'content',
        },
      ],
      assets: [],
    };

    // Rendering sans manifest (premier d\u00e9ploiement)
    const html = await renderer.render(note);

    // **SI LE TEST \u00c9CHOUE ICI** : c'est LA PREUVE du bug
    //   - isBackendResolvedWikilink devrait \u00eatre true (data-wikilink + href + !href.startsWith('#'))
    //   - Le lien devrait rester <a>, pas devenir <span>
    expect(html).toContain('<a');
    expect(html).toContain('class="wikilink"');
    expect(html).toContain('data-wikilink="Sens et capacit\u00e9s"');
    expect(html).toContain('href="/regles-de-la-table/sens-et-capacites#vision-thermique"');
    expect(html).toContain('>vision thermique<');
    expect(html).not.toContain('wikilink-unresolved');
    expect(html).not.toContain('<span');
    expect(html).not.toContain('aria-disabled="true"');
  });
});
