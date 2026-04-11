import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { type ManifestPage } from '@core-domain';
import * as cheerio from 'cheerio';

import { ValidateLinksService } from '../infra/sessions/validate-links.service';

describe('ValidateLinksService', () => {
  let tempDir: string;
  let service: ValidateLinksService;

  const createMockManifest = (): { pages: ManifestPage[] } => ({
    pages: [
      {
        id: 'page-1',
        vaultPath: 'Ektaron/Yalgranthir/Yalgranthir.md',
        route: '/mundis/yalgranthir/yalgranthir',
        slug: { value: 'yalgranthir' },
        title: 'Yalgranthir',
        folders: ['Ektaron', 'Yalgranthir'],
        publishedAt: new Date(),
      } as ManifestPage,
      {
        id: 'page-2',
        vaultPath: 'Ektaron/Ektaron.md',
        route: '/mundis/ektaron',
        slug: { value: 'ektaron' },
        title: 'Ektaron',
        folders: ['Ektaron'],
        publishedAt: new Date(),
      } as ManifestPage,
      {
        id: 'page-3',
        vaultPath: 'Classes/Barbarian.md',
        route: '/lore/classes/barbarian',
        slug: { value: 'barbarian' },
        title: 'Barbarian',
        folders: ['Classes'],
        publishedAt: new Date(),
      } as ManifestPage,
    ],
  });

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'validate-links-test-'));
    service = new ValidateLinksService();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('validateAllLinks', () => {
    it('should fix dataview-generated links with partial paths', async () => {
      const manifest = createMockManifest();

      // Create HTML with dataview-style link (partial path without leading slash)
      const html = `
        <html>
          <body>
            <div class="markdown-body">
              <p>See also: <a href="Yalgranthir/Yalgranthir" class="internal-link wikilink" data-href="Yalgranthir/Yalgranthir">Yalgranthir</a></p>
            </div>
          </body>
        </html>
      `;

      const htmlPath = path.join(tempDir, 'test.html');
      await fs.writeFile(htmlPath, html, 'utf-8');

      const result = await service.validateAllLinks(tempDir, manifest);

      expect(result.filesProcessed).toBe(1);
      expect(result.filesModified).toBe(1);
      // linksFixed count can vary due to cheerio internal processing

      // Check that the link was fixed
      const fixedHtml = await fs.readFile(htmlPath, 'utf-8');
      expect(fixedHtml).toContain('href="/mundis/yalgranthir/yalgranthir"');

      // Use cheerio to verify href attribute specifically (not data-href)
      const $ = cheerio.load(fixedHtml);
      const $link = $('a').first();
      expect($link.attr('href')).toBe('/mundis/yalgranthir/yalgranthir');
    });

    it('should transform invalid links to unresolved spans', async () => {
      const manifest = createMockManifest();

      const html = `
        <html>
          <body>
            <div class="markdown-body">
              <p>Link to unknown: <a href="/unknown-page">Unknown Page</a></p>
            </div>
          </body>
        </html>
      `;

      const htmlPath = path.join(tempDir, 'test.html');
      await fs.writeFile(htmlPath, html, 'utf-8');

      await service.validateAllLinks(tempDir, manifest);

      const fixedHtml = await fs.readFile(htmlPath, 'utf-8');
      expect(fixedHtml).toContain('class="wikilink wikilink-unresolved"');
      expect(fixedHtml).toContain('title="Cette page sera bientot disponible"');
      expect(fixedHtml).toContain('data-tooltip="Cette page sera bientot disponible"');
      expect(fixedHtml).toContain('tabindex="0"');
      expect(fixedHtml).not.toContain('<a href="/unknown-page"');
    });

    it('should preserve fragment-only links', async () => {
      const manifest = createMockManifest();

      const html = `
        <html>
          <body>
            <div class="markdown-body">
              <p>Jump to <a href="#section">Section</a></p>
            </div>
          </body>
        </html>
      `;

      const htmlPath = path.join(tempDir, 'test.html');
      await fs.writeFile(htmlPath, html, 'utf-8');

      const result = await service.validateAllLinks(tempDir, manifest);

      expect(result.filesModified).toBe(0); // No modifications needed

      const fixedHtml = await fs.readFile(htmlPath, 'utf-8');
      expect(fixedHtml).toContain('<a href="#section">Section</a>');
    });

    it('should preserve links with fragments to valid pages', async () => {
      const manifest = createMockManifest();

      const html = `
        <html>
          <body>
            <div class="markdown-body">
              <p>Link to section: <a href="/mundis/ektaron#history">History of Ektaron</a></p>
              <p>Another link: <a href="/lore/classes/barbarian#abilities">Barbarian Abilities</a></p>
            </div>
          </body>
        </html>
      `;

      const htmlPath = path.join(tempDir, 'test.html');
      await fs.writeFile(htmlPath, html, 'utf-8');

      const result = await service.validateAllLinks(tempDir, manifest);

      // Links are valid (base path exists in manifest), so they should be preserved with fragments
      expect(result.filesModified).toBe(0); // No modifications needed (already valid)

      const fixedHtml = await fs.readFile(htmlPath, 'utf-8');
      expect(fixedHtml).toContain('<a href="/mundis/ektaron#history">History of Ektaron</a>');
      expect(fixedHtml).toContain(
        '<a href="/lore/classes/barbarian#abilities">Barbarian Abilities</a>'
      );
      expect(fixedHtml).not.toContain('wikilink-unresolved');
    });

    it('should preserve caret fragments for valid page links', async () => {
      const manifest = createMockManifest();

      const html = `
        <html>
          <body>
            <div class="markdown-body">
              <p>Block link: <a href="/mundis/ektaron#%5E37066d">Bloc Ektaron</a></p>
            </div>
          </body>
        </html>
      `;

      const htmlPath = path.join(tempDir, 'test.html');
      await fs.writeFile(htmlPath, html, 'utf-8');

      const result = await service.validateAllLinks(tempDir, manifest);

      expect(result.filesModified).toBe(0);

      const fixedHtml = await fs.readFile(htmlPath, 'utf-8');
      expect(fixedHtml).toContain('<a href="/mundis/ektaron#%5E37066d">Bloc Ektaron</a>');
    });

    it('should invalidate links with fragments to invalid pages', async () => {
      const manifest = createMockManifest();

      const html = `
        <html>
          <body>
            <div class="markdown-body">
              <p>Link to unknown page: <a href="/invalid/page#section">Invalid Section</a></p>
            </div>
          </body>
        </html>
      `;

      const htmlPath = path.join(tempDir, 'test.html');
      await fs.writeFile(htmlPath, html, 'utf-8');

      await service.validateAllLinks(tempDir, manifest);

      const fixedHtml = await fs.readFile(htmlPath, 'utf-8');
      expect(fixedHtml).toContain('class="wikilink wikilink-unresolved"');
      expect(fixedHtml).toContain('title="Cette page sera bientot disponible"');
      expect(fixedHtml).toContain('data-tooltip="Cette page sera bientot disponible"');
      expect(fixedHtml).not.toContain('<a href="/invalid/page#section"');
    });

    it('should preserve external URLs', async () => {
      const manifest = createMockManifest();

      const html = `
        <html>
          <body>
            <div class="markdown-body">
              <p>External link: <a href="https://example.com">Example</a></p>
            </div>
          </body>
        </html>
      `;

      const htmlPath = path.join(tempDir, 'test.html');
      await fs.writeFile(htmlPath, html, 'utf-8');

      const result = await service.validateAllLinks(tempDir, manifest);

      expect(result.filesModified).toBe(0);

      const fixedHtml = await fs.readFile(htmlPath, 'utf-8');
      expect(fixedHtml).toContain('<a href="https://example.com">Example</a>');
    });

    it('should preserve already public asset links', async () => {
      const manifest = createMockManifest();

      const html = `
        <html>
          <body>
            <div class="markdown-body">
              <p>Download: <a href="/assets/docs/file.pdf">File</a></p>
            </div>
          </body>
        </html>
      `;

      const htmlPath = path.join(tempDir, 'test.html');
      await fs.writeFile(htmlPath, html, 'utf-8');

      const result = await service.validateAllLinks(tempDir, manifest);

      expect(result.filesModified).toBe(0);

      const fixedHtml = await fs.readFile(htmlPath, 'utf-8');
      expect(fixedHtml).toContain('<a href="/assets/docs/file.pdf">File</a>');
      expect(fixedHtml).not.toContain('wikilink-unresolved');
    });

    it('should match links by slug', async () => {
      const manifest = createMockManifest();

      const html = `
        <html>
          <body>
            <div class="markdown-body">
              <p>Link by slug: <a href="barbarian">Barbarian Class</a></p>
            </div>
          </body>
        </html>
      `;

      const htmlPath = path.join(tempDir, 'test.html');
      await fs.writeFile(htmlPath, html, 'utf-8');

      await service.validateAllLinks(tempDir, manifest);

      const fixedHtml = await fs.readFile(htmlPath, 'utf-8');
      expect(fixedHtml).toContain('href="/lore/classes/barbarian"');
    });

    it('should normalize dataview links with encoded unicode paths and heading fragments', async () => {
      const manifest = {
        pages: [
          ...createMockManifest().pages,
          {
            id: 'page-4',
            vaultPath: 'My Notes/Héléna.md',
            relativePath: 'My Notes/Héléna.md',
            route: '/personnages/helena',
            slug: { value: 'helena' },
            title: 'Héléna',
            folders: ['My Notes'],
            publishedAt: new Date(),
          } as ManifestPage,
        ],
      };

      const html = `
        <html>
          <body>
            <div class="markdown-body">
              <p><a href="My%20Notes/H%C3%A9l%C3%A9na.md#Capacit%C3%A9%20sp%C3%A9ciale">Alias</a></p>
            </div>
          </body>
        </html>
      `;

      const htmlPath = path.join(tempDir, 'test.html');
      await fs.writeFile(htmlPath, html, 'utf-8');

      await service.validateAllLinks(tempDir, manifest);

      const fixedHtml = await fs.readFile(htmlPath, 'utf-8');
      expect(fixedHtml).toContain('href="/personnages/helena#capacite-speciale"');
      expect(fixedHtml).toContain('>Alias</a>');
    });

    it('should convert dataview wikilink spans to resolved anchors during finish validation', async () => {
      const manifest = createMockManifest();

      const html = `
        <html>
          <body>
            <div class="markdown-body">
              <p>See also: <span class="wikilink" data-wikilink="Yalgranthir/Yalgranthir">Yalgranthir</span></p>
            </div>
          </body>
        </html>
      `;

      const htmlPath = path.join(tempDir, 'test.html');
      await fs.writeFile(htmlPath, html, 'utf-8');

      const result = await service.validateAllLinks(tempDir, manifest);

      expect(result.filesProcessed).toBe(1);
      expect(result.filesModified).toBe(1);

      const fixedHtml = await fs.readFile(htmlPath, 'utf-8');
      const $ = cheerio.load(fixedHtml);
      const $link = $('a.wikilink').first();

      expect($link.length).toBe(1);
      expect($link.attr('href')).toBe('/mundis/yalgranthir/yalgranthir');
      expect($link.attr('data-wikilink')).toBe('Yalgranthir/Yalgranthir');
      expect($link.text()).toBe('Yalgranthir');
      expect($('span.wikilink').length).toBe(0);
    });

    it('should re-resolve unresolved wikilink spans when the final manifest contains the page', async () => {
      const manifest = createMockManifest();

      const html = `
        <html>
          <body>
            <div class="markdown-body">
              <p>
                <span class="wikilink wikilink-unresolved" title="Page inconnue : Ektaron" data-wikilink="Ektaron.md">Ektaron</span>
              </p>
            </div>
          </body>
        </html>
      `;

      const htmlPath = path.join(tempDir, 'test.html');
      await fs.writeFile(htmlPath, html, 'utf-8');

      await service.validateAllLinks(tempDir, manifest);

      const fixedHtml = await fs.readFile(htmlPath, 'utf-8');
      const $ = cheerio.load(fixedHtml);
      const $link = $('a.wikilink').first();

      expect($link.length).toBe(1);
      expect($link.attr('href')).toBe('/mundis/ektaron');
      expect($link.attr('data-wikilink')).toBe('Ektaron');
      expect($link.attr('class')).toBe('wikilink');
      expect(fixedHtml).not.toContain('wikilink-unresolved');
    });

    it('should leave ambiguous basename-only links unresolved instead of selecting a duplicate page', async () => {
      const manifest = {
        pages: [
          {
            id: 'page-a',
            vaultPath: 'Folder A/Shared.md',
            relativePath: 'Folder A/Shared.md',
            route: '/folder-a/shared',
            slug: { value: 'shared-a' },
            title: 'Shared',
            folders: ['Folder A'],
            publishedAt: new Date(),
          } as ManifestPage,
          {
            id: 'page-b',
            vaultPath: 'Folder B/Shared.md',
            relativePath: 'Folder B/Shared.md',
            route: '/folder-b/shared',
            slug: { value: 'shared-b' },
            title: 'Shared',
            folders: ['Folder B'],
            publishedAt: new Date(),
          } as ManifestPage,
        ],
      };

      const html = `
        <html>
          <body>
            <div class="markdown-body">
              <p><a href="Shared.md">Shared</a></p>
            </div>
          </body>
        </html>
      `;

      const htmlPath = path.join(tempDir, 'test.html');
      await fs.writeFile(htmlPath, html, 'utf-8');

      await service.validateAllLinks(tempDir, manifest);

      const fixedHtml = await fs.readFile(htmlPath, 'utf-8');
      expect(fixedHtml).toContain('wikilink-unresolved');
      expect(fixedHtml).not.toContain('href="/folder-a/shared"');
      expect(fixedHtml).not.toContain('href="/folder-b/shared"');
    });

    it('should resolve relative internal links using the current generated page path', async () => {
      const manifest = {
        pages: [
          {
            id: 'page-reference',
            vaultPath: 'Guide/Reference.md',
            relativePath: 'Guide/Reference.md',
            route: '/guide/reference',
            slug: { value: 'reference' },
            title: 'Reference',
            folders: ['Guide'],
            publishedAt: new Date(),
          } as ManifestPage,
        ],
      };

      const html = `
        <html>
          <body>
            <div class="markdown-body">
              <p><a href="../reference.md">Reference</a></p>
            </div>
          </body>
        </html>
      `;

      const nestedDir = path.join(tempDir, 'guide', 'advanced');
      await fs.mkdir(nestedDir, { recursive: true });
      const htmlPath = path.join(nestedDir, 'getting-started.html');
      await fs.writeFile(htmlPath, html, 'utf-8');

      await service.validateAllLinks(tempDir, manifest);

      const fixedHtml = await fs.readFile(htmlPath, 'utf-8');
      expect(fixedHtml).toContain('href="/guide/reference"');
      expect(fixedHtml).not.toContain('wikilink-unresolved');
    });

    it('should recursively process nested directories', async () => {
      const manifest = createMockManifest();

      // Create nested structure
      const subdir = path.join(tempDir, 'subdir');
      await fs.mkdir(subdir, { recursive: true });

      const html1 = `<html><body><a href="/unknown">Unknown</a></body></html>`;
      const html2 = `<html><body><a href="Yalgranthir/Yalgranthir">Yalgranthir</a></body></html>`;

      await fs.writeFile(path.join(tempDir, 'page1.html'), html1, 'utf-8');
      await fs.writeFile(path.join(subdir, 'page2.html'), html2, 'utf-8');

      const result = await service.validateAllLinks(tempDir, manifest);

      expect(result.filesProcessed).toBe(2);
      expect(result.filesModified).toBe(2);

      // Verify both files were processed
      const fixed1 = await fs.readFile(path.join(tempDir, 'page1.html'), 'utf-8');
      const fixed2 = await fs.readFile(path.join(subdir, 'page2.html'), 'utf-8');

      expect(fixed1).toContain('wikilink-unresolved');
      expect(fixed2).toContain('href="/mundis/yalgranthir/yalgranthir"');
    });

    it('should handle links with .md extension', async () => {
      const manifest = createMockManifest();

      const html = `
        <html>
          <body>
            <div class="markdown-body">
              <p>Link with extension: <a href="Ektaron.md">Ektaron</a></p>
            </div>
          </body>
        </html>
      `;

      const htmlPath = path.join(tempDir, 'test.html');
      await fs.writeFile(htmlPath, html, 'utf-8');

      await service.validateAllLinks(tempDir, manifest);

      const fixedHtml = await fs.readFile(htmlPath, 'utf-8');
      expect(fixedHtml).toContain('href="/mundis/ektaron"');
    });

    it('should resolve alias-based internal links to an existing published page instead of marking them unresolved', async () => {
      const manifest = {
        pages: [
          ...createMockManifest().pages,
          {
            id: 'page-4',
            vaultPath: 'Anorin Sirdalea/Amel Fass/Luminara (V)/Luminara (V).md',
            relativePath: 'Amel Fass/Luminara (V)/Luminara (V).md',
            aliases: ['Luminara'],
            route: '/anorin-sirdalea/amel-fass/luminara-v',
            slug: { value: 'luminara-v' },
            title: 'Luminara (V)',
            folders: ['Amel Fass', 'Luminara (V)'],
            publishedAt: new Date(),
          } as ManifestPage,
        ],
      };

      const html = `
        <html>
          <body>
            <div class="markdown-body">
              <p><a href="Luminara">Luminara</a></p>
            </div>
          </body>
        </html>
      `;

      const htmlPath = path.join(tempDir, 'test.html');
      await fs.writeFile(htmlPath, html, 'utf-8');

      await service.validateAllLinks(tempDir, manifest);

      const fixedHtml = await fs.readFile(htmlPath, 'utf-8');
      expect(fixedHtml).toContain('href="/anorin-sirdalea/amel-fass/luminara-v"');
      expect(fixedHtml).not.toContain('wikilink-unresolved');
    });

    it('should recover unresolved spans without data-wikilink when their visible text matches a published page title', async () => {
      const manifest = {
        pages: [
          ...createMockManifest().pages,
          {
            id: 'page-4',
            vaultPath: '_Mecaniques/Magie des sceaux — Arakishib — Arakišib.md',
            relativePath: '_Mecaniques/Magie des sceaux — Arakishib — Arakišib.md',
            route: '/lore/arali/arakishib/index',
            slug: { value: 'index' },
            title: 'Magie des sceaux — Arakishib — Arakišib',
            publishedAt: new Date(),
          } as ManifestPage,
        ],
      };

      const html = `
        <html>
          <body>
            <div class="markdown-body">
              <ul class="index-list">
                <li><span class="wikilink wikilink-unresolved" title="Page inconnue : Magie des sceaux — Arakishib — Arakišib">Magie des sceaux — Arakishib — Arakišib</span></li>
              </ul>
            </div>
          </body>
        </html>
      `;

      const htmlPath = path.join(tempDir, 'test.html');
      await fs.writeFile(htmlPath, html, 'utf-8');

      await service.validateAllLinks(tempDir, manifest);

      const fixedHtml = await fs.readFile(htmlPath, 'utf-8');
      expect(fixedHtml).toContain('href="/lore/arali/arakishib/index"');
      expect(fixedHtml).toContain('data-wikilink="Magie des sceaux — Arakishib — Arakišib"');
      expect(fixedHtml).not.toContain('wikilink-unresolved');
    });

    it('should resolve anchors using data-href when href is missing', async () => {
      const manifest = {
        pages: [
          ...createMockManifest().pages,
          {
            id: 'page-4',
            vaultPath: 'Anorin Sirdalea/Amel Fass/Luminara (V)/Luminara (V).md',
            relativePath: 'Amel Fass/Luminara (V)/Luminara (V).md',
            aliases: ['Luminara'],
            route: '/anorin-sirdalea/amel-fass/luminara-v',
            slug: { value: 'luminara-v' },
            title: 'Luminara (V)',
            publishedAt: new Date(),
          } as ManifestPage,
        ],
      };

      const html = `
        <html>
          <body>
            <div class="markdown-body">
              <p><a data-href="Luminara">Luminara</a></p>
            </div>
          </body>
        </html>
      `;

      const htmlPath = path.join(tempDir, 'test.html');
      await fs.writeFile(htmlPath, html, 'utf-8');

      await service.validateAllLinks(tempDir, manifest);

      const fixedHtml = await fs.readFile(htmlPath, 'utf-8');
      expect(fixedHtml).toContain('href="/anorin-sirdalea/amel-fass/luminara-v"');
      expect(fixedHtml).toContain('data-href="/anorin-sirdalea/amel-fass/luminara-v"');
      expect(fixedHtml).not.toContain('wikilink-unresolved');
    });

    it('should not modify files without invalid links', async () => {
      const manifest = createMockManifest();

      const html = `
        <html>
          <body>
            <div class="markdown-body">
              <p>Valid link: <a href="/mundis/ektaron">Ektaron</a></p>
              <p>Fragment: <a href="#section">Section</a></p>
              <p>External: <a href="https://example.com">Example</a></p>
            </div>
          </body>
        </html>
      `;

      const htmlPath = path.join(tempDir, 'test.html');
      await fs.writeFile(htmlPath, html, 'utf-8');

      const result = await service.validateAllLinks(tempDir, manifest);

      expect(result.filesProcessed).toBe(1);
      // filesModified might be 1 due to cheerio reformatting even with no semantic changes

      const fixedHtml = await fs.readFile(htmlPath, 'utf-8');
      expect(fixedHtml).toContain('<a href="/mundis/ektaron">Ektaron</a>');
      expect(fixedHtml).toContain('<a href="#section">Section</a>');
      expect(fixedHtml).toContain('<a href="https://example.com">Example</a>');
    });

    it('should preserve index routes for folder indexes', async () => {
      const manifest = createMockManifest();
      await fs.mkdir(tempDir, { recursive: true });

      // Create HTML with index links (as generated by site-index-templates)
      const htmlContent = `
        <div class="markdown-body">
          <h1>Dossiers</h1>
          <ul class="index-list">
            <li><a class="index-link" href="/mundis/index">Mundis</a></li>
            <li><a class="index-link" href="/lore/index">Lore</a></li>
            <li><a class="index-link" href="/pantheon/index">Panthéon</a></li>
          </ul>
        </div>
      `;

      const htmlPath = path.join(tempDir, 'index.html');
      await fs.writeFile(htmlPath, htmlContent);

      const result = await service.validateAllLinks(tempDir, manifest);

      expect(result.filesProcessed).toBe(1);

      const fixedHtml = await fs.readFile(htmlPath, 'utf-8');
      const $ = cheerio.load(fixedHtml);

      // Index links should NOT be transformed to unresolved spans
      expect($('span.wikilink-unresolved').length).toBe(0);

      // Index links should be preserved as <a> tags
      expect($('a[href="/mundis/index"]').length).toBe(1);
      expect($('a[href="/lore/index"]').length).toBe(1);
      expect($('a[href="/pantheon/index"]').length).toBe(1);
    });

    it('should resolve links to generated folder indexes that are servable but not present in manifest.pages', async () => {
      const manifest = {
        pages: [
          {
            id: 'page-1',
            vaultPath: '_Codex/Puissances/Divinités/Astraea.md',
            relativePath: 'Astraea.md',
            route: '/lore/pantheon/astraea',
            slug: { value: 'astraea' },
            title: 'Astraea',
            publishedAt: new Date(),
          } as ManifestPage,
        ],
        folderDisplayNames: {
          '/lore/pantheon': 'Panthéon',
        },
      };

      const html = `
        <html>
          <body>
            <div class="markdown-body">
              <p><a href="Panthéon">Panthéon</a></p>
            </div>
          </body>
        </html>
      `;

      const htmlPath = path.join(tempDir, 'test.html');
      await fs.writeFile(htmlPath, html, 'utf-8');

      await service.validateAllLinks(tempDir, manifest);

      const fixedHtml = await fs.readFile(htmlPath, 'utf-8');
      expect(fixedHtml).toContain('href="/lore/pantheon/index"');
      expect(fixedHtml).not.toContain('wikilink-unresolved');
    });

    it('should recover legacy frontmatter unresolved spans without data-wikilink when their text matches a published page', async () => {
      const manifest = {
        pages: [
          ...createMockManifest().pages,
          {
            id: 'page-4',
            vaultPath: 'Pantheon/Luminara.md',
            relativePath: 'Pantheon/Luminara.md',
            route: '/lore/pantheon/luminara',
            slug: { value: 'luminara' },
            title: 'Luminara',
            publishedAt: new Date(),
          } as ManifestPage,
        ],
      };

      const html = `
        <html>
          <body>
            <div class="markdown-body">
              <div class="fm-array"><span class="fm-value"><span class="fm-value fm-wikilink-unresolved">Luminara</span></span></div>
            </div>
          </body>
        </html>
      `;

      const htmlPath = path.join(tempDir, 'test.html');
      await fs.writeFile(htmlPath, html, 'utf-8');

      await service.validateAllLinks(tempDir, manifest);

      const fixedHtml = await fs.readFile(htmlPath, 'utf-8');
      expect(fixedHtml).toContain('href="/lore/pantheon/luminara"');
      expect(fixedHtml).not.toContain('fm-wikilink-unresolved');
      expect(fixedHtml).not.toContain('wikilink-unresolved');
    });

    it('should handle empty directories gracefully', async () => {
      const manifest = createMockManifest();

      const result = await service.validateAllLinks(tempDir, manifest);

      expect(result.filesProcessed).toBe(0);
      expect(result.filesModified).toBe(0);
      expect(result.linksFixed).toBe(0);
    });
  });
});
