import type { CollectedNote } from '@core-domain/entities/collected-note';
import type { IgnoreRule } from '@core-domain/entities/ignore-rule';

import { EvaluateIgnoreRulesHandler } from '../../vault-parsing/handler/evaluate-ignore-rules.handler';
import { ParseContentHandler } from '../../vault-parsing/handler/parse-content.handler';
import { NotesMapper } from '../../vault-parsing/mappers/notes.mapper';
import { ComputeRoutingService } from '../../vault-parsing/services/compute-routing.service';
import { DeduplicateNotesService } from '../../vault-parsing/services/deduplicate-notes.service';
import { DetectAssetsService } from '../../vault-parsing/services/detect-assets.service';
import { DetectLeafletBlocksService } from '../../vault-parsing/services/detect-leaflet-blocks.service';
import { DetectWikilinksService } from '../../vault-parsing/services/detect-wikilinks.service';
import { DeterministicNoteTransformsService } from '../../vault-parsing/services/deterministic-note-transforms.service';
import { EnsureTitleHeaderService } from '../../vault-parsing/services/ensure-title-header.service';
import { NormalizeFrontmatterService } from '../../vault-parsing/services/normalize-frontmatter.service';
import { RemoveNoPublishingMarkerService } from '../../vault-parsing/services/remove-no-publishing-marker.service';
import { RenderInlineDataviewService } from '../../vault-parsing/services/render-inline-dataview.service';
import { ResolveWikilinksService } from '../../vault-parsing/services/resolve-wikilinks.service';
import { NoopLogger } from '../helpers/fake-logger';

describe('DeterministicNoteTransformsService parity', () => {
  const logger = new NoopLogger();

  function buildParseHandler(
    mode: 'plugin' | 'api',
    ignoreRules: IgnoreRule[] = [],
    dataviewProcessor?: (notes: any[], cancellation?: any) => Promise<any[]>
  ) {
    const normalizeFrontmatterService = new NormalizeFrontmatterService(logger);
    const evaluateIgnoreRulesHandler = new EvaluateIgnoreRulesHandler(ignoreRules, logger);
    const noteMapper = new NotesMapper();
    const inlineDataviewRenderer = new RenderInlineDataviewService(logger);
    const leafletBlocksDetector = new DetectLeafletBlocksService(logger);
    const ensureTitleHeaderService = new EnsureTitleHeaderService(logger);
    const removeNoPublishingMarkerService = new RemoveNoPublishingMarkerService(logger);
    const assetsDetector = new DetectAssetsService(logger);
    const detectWikilinks = new DetectWikilinksService(logger);
    const resolveWikilinks = new ResolveWikilinksService(logger, detectWikilinks);
    const computeRoutingService = new ComputeRoutingService(logger);

    return new ParseContentHandler(
      normalizeFrontmatterService,
      evaluateIgnoreRulesHandler,
      noteMapper,
      inlineDataviewRenderer,
      leafletBlocksDetector,
      ensureTitleHeaderService,
      removeNoPublishingMarkerService,
      assetsDetector,
      resolveWikilinks,
      computeRoutingService,
      logger,
      dataviewProcessor,
      undefined,
      undefined,
      { deterministicTransformsOwner: mode }
    );
  }

  const folder = {
    id: 'folder',
    vaultFolder: 'Vault/Blog',
    routeBase: '/blog',
    vpsId: 'vps',
    ignoredCleanupRuleIds: [],
  };

  it('matches plugin-owned routing, inline dataview, title insertion, and wikilinks', async () => {
    const notes: CollectedNote[] = [
      {
        noteId: 'a',
        title: 'Alpha',
        vaultPath: 'Vault/Blog/Alpha.md',
        relativePath: 'Alpha.md',
        content: 'Link to [[Beta]] and `=this.title`',
        frontmatter: { publish: true, aliases: ['Leader'] } as any,
        folderConfig: folder,
      },
      {
        noteId: 'b',
        title: 'Beta',
        vaultPath: 'Vault/Blog/Beta.md',
        relativePath: 'Beta.md',
        content: 'Target note',
        frontmatter: { publish: true } as any,
        folderConfig: folder,
      },
    ];

    const pluginOwned = await buildParseHandler('plugin', [
      { property: 'publish', ignoreIf: false } as any,
    ]).handle(notes);

    const apiPrepared = await buildParseHandler('api', [
      { property: 'publish', ignoreIf: false } as any,
    ]).handle(notes);
    const apiOwned = await new DeterministicNoteTransformsService(logger).process(apiPrepared, {
      ignoreRules: [{ property: 'publish', ignoreIf: false } as any],
      deduplicationEnabled: true,
    });

    expect(apiOwned.map((note) => note.routing.fullPath)).toEqual(
      pluginOwned.map((note) => note.routing.fullPath)
    );
    expect(apiOwned.map((note) => note.content)).toEqual(pluginOwned.map((note) => note.content));
    expect(apiOwned.map((note) => note.routing.slug)).toEqual(
      pluginOwned.map((note) => note.routing.slug)
    );
    expect(
      apiOwned[0].resolvedWikilinks?.map((link) => ({
        raw: link.raw,
        targetNoteId: link.targetNoteId,
        isResolved: link.isResolved,
        href: link.href,
        target: link.target,
      }))
    ).toEqual(
      pluginOwned[0].resolvedWikilinks?.map((link) => ({
        raw: link.raw,
        targetNoteId: link.targetNoteId,
        isResolved: link.isResolved,
        href: link.href,
        target: link.target,
      }))
    );
  });

  it('matches plugin-owned deduplication results', async () => {
    const duplicateNotes: CollectedNote[] = [
      {
        noteId: 'a',
        title: 'Report',
        vaultPath: 'Vault/Blog/Folder/Report.md',
        relativePath: 'Folder/Report.md',
        content: 'Longer content wins',
        frontmatter: { publish: true } as any,
        folderConfig: folder,
      },
      {
        noteId: 'b',
        title: 'Report',
        vaultPath: 'Vault/Blog/Other/Report.md',
        relativePath: 'Other/Report.md',
        content: 'Short',
        frontmatter: { publish: true } as any,
        folderConfig: folder,
      },
    ];

    const pluginOwned = new DeduplicateNotesService(logger).process(
      await buildParseHandler('plugin').handle(duplicateNotes)
    );
    const apiPrepared = await buildParseHandler('api').handle(duplicateNotes);
    const apiOwned = await new DeterministicNoteTransformsService(logger).process(apiPrepared, {
      deduplicationEnabled: true,
    });

    expect(apiOwned.map((note) => note.routing.fullPath).sort()).toEqual(
      pluginOwned.map((note) => note.routing.fullPath).sort()
    );
    expect(apiOwned.map((note) => note.routing.slug).sort()).toEqual(
      pluginOwned.map((note) => note.routing.slug).sort()
    );
  });
});
