/**
 * Test reproduction pour le bug: [[Sens et capacités#Vision thermique|vision thermique]]
 *
 * Ce test démontre le bug où un wikilink vers un header, résolu par le backend,
 * est invalidé par cleanAndNormalizeLinks et transformé en span unresolved.
 *
 * Contexte factuel:
 * - Note source: test-vault/_Trésors/Objets Magiques/Objet merveilleux/Masque de tacticien basique.md
 * - Note cible: test-vault/_Mecaniques/Homebrew/Règles/Sens et capacités.md
 * - Wikilink: [[Sens et capacités#Vision thermique|vision thermique]]
 * - Le backend génère un lien résolu avec href="/regles-de-la-table/sens-et-capacites#vision-thermique"
 * - cleanAndNormalizeLinks invalide ce lien
 */

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Manifest, Slug } from '@core-domain';
import { describe, expect, it } from '@jest/globals';
import * as cheerio from 'cheerio';

import { MarkdownItRenderer } from '../infra/markdown/markdown-it.renderer';
import { ValidateLinksService } from '../infra/sessions/validate-links.service';

describe('Bug: Wikilink avec header - [[Sens et capacités#Vision thermique]]', () => {
  let renderer: MarkdownItRenderer;

  beforeEach(() => {
    renderer = new MarkdownItRenderer();
  });

  it('should NOT invalidate backend-resolved wikilink with header fragment', () => {
    // Manifest simulant la page cible publiée
    const mockManifest: Manifest = {
      sessionId: 'test',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      pages: [
        {
          id: '1',
          title: 'Sens et capacités',
          slug: Slug.from('sens-et-capacites'),
          route: '/regles-de-la-table/sens-et-capacites',
          vaultPath: '_Mecaniques/Homebrew/Règles/Sens et capacités.md',
          relativePath: '_Mecaniques/Homebrew/Règles/Sens et capacités.md',
          publishedAt: new Date(),
        },
      ],
    };

    // HTML généré par renderWikilink() pour le lien résolu par le backend
    // Ce HTML correspond à ce que injectWikilinks() produit AVANT cleanAndNormalizeLinks
    const backendResolvedHtml = `<a class="wikilink" data-wikilink="Sens et capacités" href="/regles-de-la-table/sens-et-capacites#vision-thermique">vision thermique</a>`;

    // Passage dans cleanAndNormalizeLinks (comme dans le pipeline réel ligne 197)
    const result = (renderer as any).cleanAndNormalizeLinks(backendResolvedHtml, mockManifest);

    // CRITÈRE D'ACCEPTATION: Le lien doit rester un <a>, PAS devenir un <span>
    expect(result).toContain('<a');
    expect(result).toContain('href="/regles-de-la-table/sens-et-capacites#vision-thermique"');
    expect(result).toContain('data-wikilink="Sens et capacités"');
    expect(result).toContain('>vision thermique<');

    // Vérification négative: NE DOIT PAS contenir de span unresolved
    expect(result).not.toContain('wikilink-unresolved');
    expect(result).not.toContain('<span');
    expect(result).not.toContain('aria-disabled="true"');
  });

  it('should preserve backend-resolved wikilink even when manifest match is ambiguous', () => {
    // Cas où le manifest est présent mais le matching pourrait échouer
    const mockManifest: Manifest = {
      sessionId: 'test',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      pages: [
        {
          id: '1',
          title: 'Sens et capacités',
          slug: Slug.from('sens-et-capacites'),
          route: '/regles-de-la-table/sens-et-capacites',
          vaultPath: '_Mecaniques/Homebrew/Règles/Sens et capacités.md',
          relativePath: '_Mecaniques/Homebrew/Règles/Sens et capacités.md',
          publishedAt: new Date(),
        },
      ],
    };

    // Plusieurs variantes de href que le backend pourrait générer
    const testCases = [
      {
        name: 'avec route complète + fragment',
        html: `<a class="wikilink" data-wikilink="Sens et capacités" href="/regles-de-la-table/sens-et-capacites#vision-thermique">vision thermique</a>`,
      },
      {
        name: 'avec path relatif + fragment',
        html: `<a class="wikilink" data-wikilink="Sens et capacités" href="sens-et-capacites#vision-thermique">vision thermique</a>`,
      },
      {
        name: 'avec fragment seulement (heading anchor)',
        html: `<a class="wikilink" data-wikilink="#Vision thermique" href="#vision-thermique">vision thermique</a>`,
      },
    ];

    testCases.forEach(({ name: _name, html }) => {
      const result = (renderer as any).cleanAndNormalizeLinks(html, mockManifest);

      // Tous ces liens ont data-wikilink ET href → doivent être considérés comme backend-resolved
      // Test case context: ${name}
      expect(result).toContain('<a');
      expect(result).not.toContain('wikilink-unresolved');
      expect(result).not.toContain('<span');
    });
  });

  it('should handle case where href has fragment but matches manifest page', () => {
    const mockManifest: Manifest = {
      sessionId: 'test',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      pages: [
        {
          id: '1',
          title: 'Sens et capacités',
          slug: Slug.from('sens-et-capacites'),
          route: '/regles-de-la-table/sens-et-capacites',
          vaultPath: '_Mecaniques/Homebrew/Règles/Sens et capacités.md',
          relativePath: '_Mecaniques/Homebrew/Règles/Sens et capacités.md',
          publishedAt: new Date(),
        },
      ],
    };

    // Le href contient un fragment, mais la partie avant # correspond à une page du manifest
    const html = `<a class="wikilink" data-wikilink="Sens et capacités" href="/regles-de-la-table/sens-et-capacites#vision-thermique">vision thermique</a>`;

    const result = (renderer as any).cleanAndNormalizeLinks(html, mockManifest);

    // Le lien doit rester valide car:
    // 1. Il a data-wikilink (marque backend-resolved)
    // 2. Il a un href non-#-only (pas un ancre local)
    // 3. La condition isBackendResolvedWikilink devrait être true
    expect(result).toContain('<a');
    expect(result).toContain('href="/regles-de-la-table/sens-et-capacites#vision-thermique"');
    expect(result).not.toContain('wikilink-unresolved');
  });

  it('should keep the rendered and validated href identical for the same canonical heading link', async () => {
    const mockManifest: Manifest = {
      sessionId: 'test',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      pages: [
        {
          id: '1',
          title: 'Sens et capacités',
          slug: Slug.from('sens-et-capacites'),
          route: '/regles-de-la-table/sens-et-capacites',
          vaultPath: '_Mecaniques/Homebrew/Regles/Sens et capacités.md',
          relativePath: '_Mecaniques/Homebrew/Regles/Sens et capacités.md',
          publishedAt: new Date(),
        },
      ],
    };
    const html = `<a class="wikilink" data-wikilink="Sens et capacités" href="/regles-de-la-table/sens-et-capacites#vision-thermique">vision thermique</a>`;
    const rendered = (renderer as any).cleanAndNormalizeLinks(html, mockManifest);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wikilink-parity-'));
    const htmlPath = path.join(tempDir, 'page.html');
    await fs.writeFile(
      htmlPath,
      `<html><body><div class="markdown-body">${rendered}</div></body></html>`,
      'utf-8'
    );

    const validator = new ValidateLinksService();
    await validator.validateAllLinks(tempDir, { pages: mockManifest.pages });

    const validated = await fs.readFile(htmlPath, 'utf-8');
    const renderedHref = cheerio.load(rendered)('a').attr('href');
    const validatedHref = cheerio.load(validated)('a').attr('href');

    expect(validatedHref).toBe(renderedHref);

    await fs.rm(tempDir, { recursive: true, force: true });
  });
});
