import type { CollectedNote } from '@core-domain/entities/collected-note';
import type { IgnoreRule } from '@core-domain/entities/ignore-rule';

import { EvaluateIgnoreRulesHandler } from '../../vault-parsing/handler/evaluate-ignore-rules.handler';
import { ParseContentHandler } from '../../vault-parsing/handler/parse-content.handler';
import { NotesMapper } from '../../vault-parsing/mappers/notes.mapper';
import { DetectAssetsService } from '../../vault-parsing/services/detect-assets.service';
import { DetectLeafletBlocksService } from '../../vault-parsing/services/detect-leaflet-blocks.service';
import { NormalizeFrontmatterService } from '../../vault-parsing/services/normalize-frontmatter.service';
import { RemoveNoPublishingMarkerService } from '../../vault-parsing/services/remove-no-publishing-marker.service';
import { RenderInlineDataviewService } from '../../vault-parsing/services/render-inline-dataview.service';
import { NoopLogger } from '../helpers/fake-logger';

describe('ParseContentHandler', () => {
  const logger = new NoopLogger();

  function buildHandler(
    ignoreRules: IgnoreRule[] = [],
    _keysToExclude: string[] = [],
    _tagsToExclude: string[] = [],
    dataviewProcessor?: (notes: any[], cancellation?: any) => Promise<any[]>
  ) {
    return new ParseContentHandler(
      new NormalizeFrontmatterService(logger),
      new EvaluateIgnoreRulesHandler(ignoreRules, logger),
      new NotesMapper(),
      new RenderInlineDataviewService(logger),
      new DetectLeafletBlocksService(logger),
      new RemoveNoPublishingMarkerService(logger),
      new DetectAssetsService(logger),
      logger,
      dataviewProcessor
    );
  }

  const baseFolder = {
    id: 'folder',
    vaultFolder: 'Vault/Blog',
    routeBase: '/blog',
    vpsId: 'vps',
    ignoredCleanupRuleIds: [],
  };

  it('filters notes using ignore rules and defers deterministic transforms to the API', async () => {
    const handler = buildHandler(
      [{ property: 'publish', ignoreIf: false } as any],
      ['secret'],
      ['private']
    );

    const noteA: CollectedNote = {
      noteId: 'a',
      title: 'Note A',
      vaultPath: 'Vault/Blog/NoteA.md',
      relativePath: 'NoteA.md',
      content: 'Hello [[NoteB.md]] ![[image.png]]\nCode: `=this.title`',
      frontmatter: {
        title: 'Note A',
        publish: true,
        secret: 'hide',
        tags: ['public', 'private'],
        cover: '![[cover.png]]',
        links: ['[[NoteB.md|Friend]]'],
      } as any,
      folderConfig: baseFolder,
    };

    const noteB: CollectedNote = {
      noteId: 'b',
      title: 'Note B',
      vaultPath: 'Vault/Blog/NoteB.md',
      relativePath: 'NoteB.md',
      content: 'Content B',
      frontmatter: { publish: true } as any,
      folderConfig: baseFolder,
    };

    const result = await handler.handle([noteA, noteB]);

    expect(result.length).toBe(2);

    const parsedA = result.find((n) => n.noteId === 'a')!;
    expect(parsedA.assets?.length).toBe(2);
    expect(
      parsedA.assets?.some((a) => a.origin === 'frontmatter' && a.target === 'cover.png')
    ).toBe(true);
    expect(parsedA.content).toContain('Hello');
    expect(parsedA.content).toContain('`=this.title`');
    expect(parsedA.frontmatter.flat.secret).toBe('hide');
    expect(parsedA.frontmatter.tags).toEqual(['public', 'private']);
    expect(parsedA.resolvedWikilinks).toBeUndefined();
    expect(parsedA.routing.fullPath).toBe(parsedA.vaultPath);
  });

  it('drops non publishable notes via ignore rules', async () => {
    const handler = buildHandler([{ property: 'publish', ignoreIf: false } as any]);
    const note: CollectedNote = {
      noteId: 'a',
      title: 'Note A',
      vaultPath: 'Vault/Blog/NoteA.md',
      relativePath: 'NoteA.md',
      content: 'hello',
      frontmatter: { publish: false } as any,
      folderConfig: baseFolder,
    };

    const result = await handler.handle([note]);
    expect(result.length).toBe(0);
  });

  it('drops notes when frontmatter is already wrapped as DomainFrontmatter', async () => {
    const handler = buildHandler([{ property: 'publish', ignoreIf: false } as any]);
    const note: CollectedNote = {
      noteId: 'a',
      title: 'Note A',
      vaultPath: 'Vault/Blog/NoteA.md',
      relativePath: 'NoteA.md',
      content: 'hello',
      frontmatter: {
        flat: { publish: false, tags: ['keep'] },
        nested: {},
        tags: ['stale'],
      } as any,
      folderConfig: baseFolder,
    };

    const result = await handler.handle([note]);
    expect(result.length).toBe(0);
  });

  it('removes no-publishing sections before and after dataview processing', async () => {
    const dataviewProcessor = jest.fn(async (notes: any[]) =>
      notes.map((note) => ({
        ...note,
        content: `${note.content}

## Dataview Private
Generated secret
^no-publishing

## Dataview Public
Generated public`,
      }))
    );

    const handler = buildHandler([], [], [], dataviewProcessor);
    const note: CollectedNote = {
      noteId: 'a',
      title: 'Note A',
      vaultPath: 'Vault/Blog/NoteA.md',
      relativePath: 'NoteA.md',
      content: `## Private Section
Secret
^no-publishing

## Public Section
Visible`,
      frontmatter: { publish: true } as any,
      folderConfig: baseFolder,
    };

    const [result] = await handler.handle([note]);

    expect(dataviewProcessor).toHaveBeenCalledTimes(1);
    expect(result.content).not.toContain('Private Section');
    expect(result.content).not.toContain('Generated secret');
    expect(result.content).toContain('## Public Section');
    expect(result.content).toContain('## Dataview Public');
    expect(result.content).not.toContain('^no-publishing');
  });

  it('defers deterministic transforms to the API while preserving asset detection inputs', async () => {
    const handler = buildHandler();
    const note: CollectedNote = {
      noteId: 'a',
      title: 'Deferred',
      vaultPath: 'Vault/Blog/Deferred.md',
      relativePath: 'Deferred.md',
      content: 'Cover: `=this.cover` and link `=this.related`',
      frontmatter: {
        publish: true,
        cover: '![[cover.png]]',
        related: '[[NoteB]]',
      } as any,
      folderConfig: baseFolder,
    };

    const [result] = await handler.handle([note]);

    expect(result.content).toContain('`=this.cover`');
    expect(result.routing.fullPath).toBe('Vault/Blog/Deferred.md');
    expect(result.resolvedWikilinks).toBeUndefined();
    expect(result.assets?.some((asset) => asset.target === 'cover.png')).toBe(true);
  });

  it('uses content-only inline dataview rendering for asset detection', async () => {
    const inlineDataviewRenderer = {
      renderContent: jest.fn(() => 'Cover: ![[cover.png]]'),
    } as unknown as RenderInlineDataviewService;

    const assetsDetector = {
      detectForContentOverride: jest.fn(() => [
        {
          raw: '![[cover.png]]',
          target: 'cover.png',
          kind: 'image',
          origin: 'content',
          display: {
            alignment: undefined,
            width: undefined,
            classes: [],
            rawModifiers: [],
          },
        },
      ]),
    } as unknown as DetectAssetsService;

    const handler = new ParseContentHandler(
      new NormalizeFrontmatterService(logger),
      new EvaluateIgnoreRulesHandler([], logger),
      new NotesMapper(),
      inlineDataviewRenderer,
      new DetectLeafletBlocksService(logger),
      new RemoveNoPublishingMarkerService(logger),
      assetsDetector,
      logger
    );

    const note: CollectedNote = {
      noteId: 'a',
      title: 'Deferred',
      vaultPath: 'Vault/Blog/Deferred.md',
      relativePath: 'Deferred.md',
      content: 'Cover: `=this.cover`',
      frontmatter: {
        publish: true,
        cover: '![[cover.png]]',
      } as any,
      folderConfig: baseFolder,
    };

    const [result] = await handler.handle([note]);

    expect((inlineDataviewRenderer as any).renderContent).toHaveBeenCalledWith(
      'Cover: `=this.cover`',
      expect.objectContaining({
        nested: expect.objectContaining({ cover: '![[cover.png]]' }),
      })
    );
    expect((assetsDetector as any).detectForContentOverride).toHaveBeenCalledTimes(1);
    expect(result.content).toBe('Cover: `=this.cover`');
    expect(result.assets?.some((asset) => asset.target === 'cover.png')).toBe(true);
  });

  it('keeps rendered dataviewjs html in note content while still discovering local html assets', async () => {
    const handler = buildHandler();
    const note: CollectedNote = {
      noteId: 'dvjs',
      title: 'DataviewJS',
      vaultPath: 'Vault/Blog/DataviewJS.md',
      relativePath: 'DataviewJS.md',
      content: '<div class="dataviewjs"><img src="gallery/rendered-cover.png" alt="cover"></div>',
      frontmatter: { publish: true } as any,
      folderConfig: baseFolder,
    };

    const [result] = await handler.handle([note]);

    expect(result.content).toContain('<img src="gallery/rendered-cover.png"');
    expect(result.assets?.some((asset) => asset.target === 'gallery/rendered-cover.png')).toBe(
      true
    );
    expect(
      result.assets?.find((asset) => asset.target === 'gallery/rendered-cover.png')?.sourceSyntax
    ).toBe('html-ref');
  });
});
