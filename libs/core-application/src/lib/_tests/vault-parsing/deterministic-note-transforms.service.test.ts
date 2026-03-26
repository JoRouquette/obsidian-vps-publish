import type { PublishableNote, ResolvedWikilink } from '@core-domain';

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
import {
  deterministicTransformParityFixtures,
  deterministicTransformParityIgnoreRules,
} from '../fixtures/deterministic-transform-parity.fixture';
import { NoopLogger } from '../helpers/fake-logger';

describe('DeterministicNoteTransformsService parity', () => {
  const logger = new NoopLogger();

  function buildParseHandler(mode: 'plugin' | 'api') {
    const normalizeFrontmatterService = new NormalizeFrontmatterService(logger);
    const evaluateIgnoreRulesHandler = new EvaluateIgnoreRulesHandler(
      deterministicTransformParityIgnoreRules,
      logger
    );
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
      undefined,
      undefined,
      undefined,
      { deterministicTransformsOwner: mode }
    );
  }

  function simplifyResolvedWikilinks(links?: ResolvedWikilink[]) {
    return (links ?? []).map((link) => ({
      raw: link.raw,
      target: link.target,
      alias: link.alias,
      subpath: link.subpath,
      targetNoteId: link.targetNoteId,
      isResolved: link.isResolved,
      origin: link.origin,
      frontmatterPath: link.frontmatterPath,
    }));
  }

  function simplifyNotes(notes: PublishableNote[]) {
    return notes
      .map((note) => ({
        noteId: note.noteId,
        title: note.title,
        route: note.routing.fullPath,
        slug: note.routing.slug,
        content: note.content,
        resolvedWikilinks: simplifyResolvedWikilinks(note.resolvedWikilinks),
      }))
      .sort((left, right) => left.noteId.localeCompare(right.noteId));
  }

  for (const fixture of deterministicTransformParityFixtures) {
    it(`matches plugin-owned deterministic output for ${fixture.id}`, async () => {
      const pluginOwned = new DeduplicateNotesService(logger).process(
        await buildParseHandler('plugin').handle(fixture.notes)
      );
      const apiPrepared = await buildParseHandler('api').handle(fixture.notes);
      const apiOwned = await new DeterministicNoteTransformsService(logger).process(apiPrepared, {
        ignoreRules: deterministicTransformParityIgnoreRules,
        deduplicationEnabled: true,
      });

      expect(simplifyNotes(apiOwned)).toEqual(simplifyNotes(pluginOwned));

      for (const ignoredNoteId of fixture.ignoredNoteIds) {
        expect(apiOwned.some((note) => note.noteId === ignoredNoteId)).toBe(false);
        expect(pluginOwned.some((note) => note.noteId === ignoredNoteId)).toBe(false);
      }
    });
  }
});
