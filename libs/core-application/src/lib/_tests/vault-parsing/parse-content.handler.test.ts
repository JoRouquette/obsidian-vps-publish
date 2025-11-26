import { ParseContentHandler } from '../../vault-parsing/handler/parse-content.handler';
import { NormalizeFrontmatterService } from '../../vault-parsing/services/normalize-frontmatter.service';
import { EvaluateIgnoreRulesHandler } from '../../vault-parsing/handler/evaluate-ignore-rules.handler';
import { RenderInlineDataviewService } from '../../vault-parsing/services/render-inline-dataview.service';
import { ContentSanitizerService } from '../../vault-parsing/services/content-sanitizer.service';
import { DetectAssetsService } from '../../vault-parsing/services/detect-assets.service';
import { DetectWikilinksService } from '../../vault-parsing/services/detect-wikilinks.service';
import { ResolveWikilinksService } from '../../vault-parsing/services/resolve-wikilinks.service';
import { ComputeRoutingService } from '../../vault-parsing/services/compute-routing.service';
import { NotesMapper } from '../../vault-parsing/mappers/notes.mapper';
import type { CollectedNote } from '@core-domain/entities/collected-note';
import type { IgnoreRule } from '@core-domain/entities/ignore-rule';
import type { LoggerPort } from '@core-domain/ports/logger-port';

class NoopLogger implements LoggerPort {
  private _level: any = 0;
  set level(level: any) {
    this._level = level;
  }
  get level() {
    return this._level;
  }
  child(): LoggerPort {
    return this;
  }
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

describe('ParseContentHandler', () => {
  const logger = new NoopLogger();

  function buildHandler(ignoreRules: IgnoreRule[] = [], keysToExclude: string[] = [], tagsToExclude: string[] = []) {
    const normalizeFrontmatterService = new NormalizeFrontmatterService(logger);
    const evaluateIgnoreRulesHandler = new EvaluateIgnoreRulesHandler(ignoreRules, logger);
    const noteMapper = new NotesMapper();
    const inlineDataviewRenderer = new RenderInlineDataviewService(logger);
    const contentSanitizer = new ContentSanitizerService([], keysToExclude, tagsToExclude, logger);
    const assetsDetector = new DetectAssetsService(logger);
    const detectWikilinks = new DetectWikilinksService(logger);
    const resolveWikilinks = new ResolveWikilinksService(logger, detectWikilinks);
    const computeRoutingService = new ComputeRoutingService(logger);

    return new ParseContentHandler(
      normalizeFrontmatterService,
      evaluateIgnoreRulesHandler,
      noteMapper,
      inlineDataviewRenderer,
      contentSanitizer,
      assetsDetector,
      resolveWikilinks,
      computeRoutingService,
      logger
    );
  }

  const baseFolder = {
    id: 'folder',
    vaultFolder: 'Vault/Blog',
    routeBase: '/blog',
    vpsId: 'vps',
  };

  const vpsConfig = { id: 'vps', name: 'vps', url: 'http://x', apiKey: 'k' };

  it('filters notes using ignore rules and resolves wikilinks/assets/routing', async () => {
    const handler = buildHandler([{ property: 'publish', ignoreIf: false } as any], ['secret'], ['private']);

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
      } as any,
      folderConfig: baseFolder,
      vpsConfig,
    };

    const noteB: CollectedNote = {
      noteId: 'b',
      title: 'Note B',
      vaultPath: 'Vault/Blog/NoteB.md',
      relativePath: 'NoteB.md',
      content: 'Content B',
      frontmatter: { publish: true } as any,
      folderConfig: baseFolder,
      vpsConfig,
    };

    const result = await handler.handle([noteA, noteB]);

    expect(result.length).toBe(2);

    const parsedA = result.find((n) => n.noteId === 'a')!;
    expect(parsedA.assets?.length).toBe(1);
    expect(parsedA.content).toContain('Hello');
    expect(parsedA.content).toContain('Note A'); // inline dataview replaced
    expect(parsedA.frontmatter.flat.secret).toBeUndefined();
    expect(parsedA.frontmatter.tags).toEqual(['public']); // private removed
    expect(parsedA.resolvedWikilinks?.[0].isResolved).toBe(true);
    expect(parsedA.routing.fullPath).toBe('/blog/notea');
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
      vpsConfig,
    };

    const result = await handler.handle([note]);
    expect(result.length).toBe(0);
  });
});
