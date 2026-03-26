import type { PublishableNote, ResolvedWikilink } from '@core-domain';

import { EvaluateIgnoreRulesHandler } from '../../vault-parsing/handler/evaluate-ignore-rules.handler';
import { ParseContentHandler } from '../../vault-parsing/handler/parse-content.handler';
import { NotesMapper } from '../../vault-parsing/mappers/notes.mapper';
import { DetectAssetsService } from '../../vault-parsing/services/detect-assets.service';
import { DetectLeafletBlocksService } from '../../vault-parsing/services/detect-leaflet-blocks.service';
import { DeterministicNoteTransformsService } from '../../vault-parsing/services/deterministic-note-transforms.service';
import { NormalizeFrontmatterService } from '../../vault-parsing/services/normalize-frontmatter.service';
import { RemoveNoPublishingMarkerService } from '../../vault-parsing/services/remove-no-publishing-marker.service';
import { RenderInlineDataviewService } from '../../vault-parsing/services/render-inline-dataview.service';
import {
  deterministicTransformParityFixtures,
  deterministicTransformParityIgnoreRules,
} from '../fixtures/deterministic-transform-parity.fixture';
import { NoopLogger } from '../helpers/fake-logger';

describe('DeterministicNoteTransformsService', () => {
  const logger = new NoopLogger();

  function buildParseHandler() {
    return new ParseContentHandler(
      new NormalizeFrontmatterService(logger),
      new EvaluateIgnoreRulesHandler(deterministicTransformParityIgnoreRules, logger),
      new NotesMapper(),
      new RenderInlineDataviewService(logger),
      new DetectLeafletBlocksService(logger),
      new RemoveNoPublishingMarkerService(logger),
      new DetectAssetsService(logger),
      logger
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
    it(`produces stable deterministic output for ${fixture.id}`, async () => {
      const prepared = await buildParseHandler().handle(fixture.notes);
      const service = new DeterministicNoteTransformsService(logger);

      const firstPass = await service.process(prepared, {
        deduplicationEnabled: true,
        ignoreRulesAlreadyApplied: true,
      });
      const secondPass = await service.process(
        prepared.map((note) => ({ ...note })),
        {
          deduplicationEnabled: true,
          ignoreRulesAlreadyApplied: true,
        }
      );

      expect(simplifyNotes(secondPass)).toEqual(simplifyNotes(firstPass));
      expect(new Set(firstPass.map((note) => note.routing.fullPath)).size).toBe(firstPass.length);

      for (const ignoredNoteId of fixture.ignoredNoteIds) {
        expect(firstPass.some((note) => note.noteId === ignoredNoteId)).toBe(false);
      }
    });
  }

  it('drops notes that are already marked non-publishable when ignore rules were applied upstream', async () => {
    const evaluated = await buildParseHandler().handle(
      deterministicTransformParityFixtures[0].notes
    );
    const noteMarkedIgnored = {
      ...evaluated[0],
      noteId: 'pre-filtered-ignored',
      eligibility: {
        isPublishable: false,
        reasons: ['pre-filtered ignore rule'],
      },
    };

    const apiOwned = await new DeterministicNoteTransformsService(logger).process(
      [...evaluated, noteMarkedIgnored],
      {
        deduplicationEnabled: true,
        ignoreRulesAlreadyApplied: true,
      }
    );

    expect(apiOwned.some((note) => note.noteId === noteMarkedIgnored.noteId)).toBe(false);
  });
});
