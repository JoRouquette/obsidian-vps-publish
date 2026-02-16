/**
 * Test E2E simplifié : Prouve le bug d'isolation des callout styles
 *
 * CE TEST DOIT ÉCHOUER (prouve le bug), puis passer après le fix.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { CalloutRendererService } from '../infra/markdown/callout-renderer.service';
import { MarkdownItRenderer } from '../infra/markdown/markdown-it.renderer';

describe('Callout Styles - Bug Isolation (Simple Unit Test)', () => {
  let tempDir: string;
  let calloutRenderer: CalloutRendererService;
  let renderer: MarkdownItRenderer;

  beforeEach(async () => {
    tempDir = path.join(__dirname, '..', 'tmp', 'test-callout-simple-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });

    // ⚠️ Simuler le singleton global (comme dans l'app réelle)
    calloutRenderer = new CalloutRendererService();
    renderer = new MarkdownItRenderer(calloutRenderer, undefined);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * PREUVE DU BUG : Le CSS utilisateur est global et pollue entre sessions
   */
  it('BUG: User CSS persists in singleton between renders (pollution)', async () => {
    // Scénario : Session A avec styles personnalisés
    const redCss = '.callout[data-callout="mytype"] { --callout-color: 255, 0, 0; }';

    calloutRenderer.extendFromStyles([{ path: 'red.css', css: redCss }]);

    // Rendu 1 : doit contenir le CSS red
    const html1 = await renderer.render({
      noteId: 'note1',
      title: 'Note 1',
      vaultPath: 'note1.md',
      relativePath: 'note1.md',
      content: '> [!mytype] Test\n> Content',
      frontmatter: { flat: {}, nested: {}, tags: [] },
      folderConfig: {
        id: 'folder-1',
        vaultFolder: 'notes',
        routeBase: '/notes',
        vpsId: 'vps-1',
        ignoredCleanupRuleIds: [],
      },
      routing: {
        slug: 'note1',
        path: '/notes',
        fullPath: '/notes/note1',
        routeBase: '/notes',
      },
      eligibility: { isPublishable: true },
      publishedAt: new Date(),
    });

    console.log('===HTML1 (avec styles)===');
    console.log(html1.substring(0, 800)); // Afficher les 800 premiers caractères        console.log('===FIN HTML1===');

    expect(html1).toContain('data-callout-styles'); // Tag de styles présent
    expect(html1).toContain('--callout-color: 255, 0, 0'); // ✅ CSS présent (attendu)

    // Scénario : Session B SANS styles (réinitialise le singleton?)
    // Dans l'app réelle, une nouvelle session appelle extendFromStyles([])
    // Mais le singleton conserve le CSS précédent !

    // NOTE: On ne réinitialise PAS le calloutRenderer ici (même instance, comme dans l'app)

    // Rendu 2 : NE devrait PAS contenir le CSS de session A
    const html2 = await renderer.render({
      noteId: 'note2',
      title: 'Note 2',
      vaultPath: 'note2.md',
      relativePath: 'note2.md',
      content: '> [!mytype] Test\n> Content',
      frontmatter: { flat: {}, nested: {}, tags: [] },
      folderConfig: {
        id: 'folder-1',
        vaultFolder: 'notes',
        routeBase: '/notes',
        vpsId: 'vps-1',
        ignoredCleanupRuleIds: [],
      },
      routing: {
        slug: 'note2',
        path: '/notes',
        fullPath: '/notes/note2',
        routeBase: '/notes',
      },
      eligibility: { isPublishable: true },
      publishedAt: new Date(),
    });

    // ⚠️ BUG ATTENDU : html2 contient ENCORE le CSS de session A
    // Ce test VA ÉCHOUER (prouve le bug)
    expect(html2).not.toContain('--callout-color: 255, 0, 0'); // ❌ Devrait être vide
  });

  /**
   * PREUVE DU BUG #2 : getUserCss() conserve le userCss entre appels
   */
  it('BUG: getUserCss() retains state from previous session', () => {
    // Session A avec styles
    const blueCss = '.callout[data-callout="blue"] { color: blue; }';
    calloutRenderer.extendFromStyles([{ path: 'blue.css', css: blueCss }]);

    let userCss = calloutRenderer.getUserCss();
    expect(userCss).toContain('color: blue'); // ✅ Présent après session A

    // Session B sans styles (simule nouvelle session)
    // Dans l'app réelle, POST /session/start avec calloutStyles: []
    // n'appelle PAS extendFromStyles (car tableau vide)
    // donc le singleton conserve son état !

    // Simulation : on n'appelle rien (comme dans le vrai code)

    userCss = calloutRenderer.getUserCss();

    // ⚠️ BUG : userCss contient toujours le CSS de la session A
    expect(userCss).toBe(''); // ❌ ÉCHEC : contient encore "color: blue"
  });
});
