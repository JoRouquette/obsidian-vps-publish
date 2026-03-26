import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildUploadSessionNotes,
  CreateSessionHandler,
  EvaluateIgnoreRulesHandler,
  FinishSessionHandler,
  NotesMapper,
  ParseContentHandler,
  UploadNotesHandler,
} from '@core-application';
import {
  deterministicTransformParityFixtures,
  deterministicTransformParityIgnoreRules,
} from '@core-application/_tests/fixtures/deterministic-transform-parity.fixture';
import { ComputeRoutingService } from '@core-application/vault-parsing/services/compute-routing.service';
import { DeduplicateNotesService } from '@core-application/vault-parsing/services/deduplicate-notes.service';
import { DetectAssetsService } from '@core-application/vault-parsing/services/detect-assets.service';
import { DetectLeafletBlocksService } from '@core-application/vault-parsing/services/detect-leaflet-blocks.service';
import { DetectWikilinksService } from '@core-application/vault-parsing/services/detect-wikilinks.service';
import { EnsureTitleHeaderService } from '@core-application/vault-parsing/services/ensure-title-header.service';
import { NormalizeFrontmatterService } from '@core-application/vault-parsing/services/normalize-frontmatter.service';
import { RemoveNoPublishingMarkerService } from '@core-application/vault-parsing/services/remove-no-publishing-marker.service';
import { RenderInlineDataviewService } from '@core-application/vault-parsing/services/render-inline-dataview.service';
import { ResolveWikilinksService } from '@core-application/vault-parsing/services/resolve-wikilinks.service';
import { type Manifest, type PublishableNote, type ResolvedWikilink } from '@core-domain';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { FileSystemSessionRepository } from '../infra/filesystem/file-system-session.repository';
import { ManifestFileSystem } from '../infra/filesystem/manifest-file-system';
import { NotesFileSystemStorage } from '../infra/filesystem/notes-file-system.storage';
import { SessionNotesFileStorage } from '../infra/filesystem/session-notes-file.storage';
import { StagingManager } from '../infra/filesystem/staging-manager';
import { UuidIdGenerator } from '../infra/id/uuid-id.generator';
import { CalloutRendererService } from '../infra/markdown/callout-renderer.service';
import { MarkdownItRenderer } from '../infra/markdown/markdown-it.renderer';
import { SessionFinalizationJobService } from '../infra/sessions/session-finalization-job.service';
import { SessionFinalizerService } from '../infra/sessions/session-finalizer.service';

describe('API-owned deterministic note transforms parity', () => {
  let tempDir: string;

  const noopLogger = {
    child() {
      return this;
    },
    debug() {
      return undefined;
    },
    info() {
      return undefined;
    },
    warn() {
      return undefined;
    },
    error() {
      return undefined;
    },
  } as any;
  const deduplicateNotesService = new DeduplicateNotesService(noopLogger);

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'api-owned-transforms-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function buildParseHandler(mode: 'plugin' | 'api') {
    const normalizeFrontmatterService = new NormalizeFrontmatterService(noopLogger);
    const evaluateIgnoreRulesHandler = new EvaluateIgnoreRulesHandler(
      deterministicTransformParityIgnoreRules,
      noopLogger
    );
    const noteMapper = new NotesMapper();
    const inlineDataviewRenderer = new RenderInlineDataviewService(noopLogger);
    const leafletBlocksDetector = new DetectLeafletBlocksService(noopLogger);
    const ensureTitleHeaderService = new EnsureTitleHeaderService(noopLogger);
    const removeNoPublishingMarkerService = new RemoveNoPublishingMarkerService(noopLogger);
    const assetsDetector = new DetectAssetsService(noopLogger);
    const detectWikilinks = new DetectWikilinksService(noopLogger);
    const resolveWikilinks = new ResolveWikilinksService(noopLogger, detectWikilinks);
    const computeRoutingService = new ComputeRoutingService(noopLogger);

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
      noopLogger,
      undefined,
      undefined,
      undefined,
      { deterministicTransformsOwner: mode }
    );
  }

  async function createEnvironment(name: string) {
    const root = path.join(tempDir, name);
    const contentRoot = path.join(root, 'content');
    const assetsRoot = path.join(root, 'assets');
    const sessionsRoot = path.join(root, 'sessions');

    await fs.mkdir(contentRoot, { recursive: true });
    await fs.mkdir(assetsRoot, { recursive: true });
    await fs.mkdir(sessionsRoot, { recursive: true });

    const sessionRepository = new FileSystemSessionRepository(sessionsRoot);
    const manifestFileSystem = new ManifestFileSystem(contentRoot);
    const markdownRenderer = new MarkdownItRenderer(new CalloutRendererService(), undefined);
    const stagingManager = new StagingManager(contentRoot, assetsRoot);
    const sessionNotesStorage = new SessionNotesFileStorage(contentRoot);
    const sessionFinalizer = new SessionFinalizerService(
      sessionNotesStorage,
      stagingManager,
      markdownRenderer,
      (sessionId) => new NotesFileSystemStorage(path.join(contentRoot, '.staging', sessionId)),
      (sessionId) => new ManifestFileSystem(path.join(contentRoot, '.staging', sessionId)),
      sessionRepository,
      undefined
    );
    const finalizationJobService = new SessionFinalizationJobService(
      sessionFinalizer,
      stagingManager,
      sessionRepository,
      undefined,
      1
    );
    const createSessionHandler = new CreateSessionHandler(
      new UuidIdGenerator(),
      sessionRepository,
      manifestFileSystem,
      undefined
    );
    const uploadNotesHandler = new UploadNotesHandler(
      markdownRenderer,
      (sessionId) => new NotesFileSystemStorage(path.join(contentRoot, '.staging', sessionId)),
      (sessionId) => new ManifestFileSystem(path.join(contentRoot, '.staging', sessionId)),
      undefined,
      sessionNotesStorage
    );
    const finishSessionHandler = new FinishSessionHandler(sessionRepository);

    return {
      contentRoot,
      createSessionHandler,
      uploadNotesHandler,
      finishSessionHandler,
      finalizationJobService,
      manifestFileSystem,
    };
  }

  async function waitForJob(
    finalizationJobService: SessionFinalizationJobService,
    jobId: string
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const poll = setInterval(() => {
        const job = finalizationJobService.getJobStatus(jobId);
        if (!job) {
          clearInterval(poll);
          reject(new Error('Job not found'));
          return;
        }

        if (job.status === 'completed') {
          clearInterval(poll);
          resolve();
          return;
        }

        if (job.status === 'failed') {
          clearInterval(poll);
          reject(new Error(job.error ?? 'Finalization failed'));
        }
      }, 50);

      setTimeout(() => {
        clearInterval(poll);
        reject(new Error('Timed out waiting for finalization'));
      }, 10000);
    });
  }

  async function readPublishedHtml(
    contentRoot: string,
    manifest: Manifest | null
  ): Promise<Record<string, string>> {
    const htmlByRoute: Record<string, string> = {};

    for (const page of manifest?.pages ?? []) {
      const segments = page.route.split('/').filter(Boolean);
      const htmlPath = path.join(contentRoot, ...segments.slice(0, -1), `${segments.at(-1)}.html`);
      htmlByRoute[page.route] = await fs.readFile(htmlPath, 'utf8');
    }

    return htmlByRoute;
  }

  function simplifyResolvedWikilinks(links?: ResolvedWikilink[]) {
    return (links ?? []).map((link) => ({
      raw: link.raw,
      target: link.target,
      alias: link.alias,
      subpath: link.subpath,
      targetNoteId: link.targetNoteId,
      isResolved: link.isResolved,
      href: link.href,
      path: link.path,
    }));
  }

  function simplifyManifest(manifest: Manifest | null) {
    return (manifest?.pages ?? [])
      .map((page) => ({
        id: page.id,
        title: page.title,
        route: page.route,
        aliases: page.aliases ?? [],
      }))
      .sort((left, right) => left.route.localeCompare(right.route));
  }

  function simplifyNotes(notes: PublishableNote[]) {
    return notes
      .map((note) => ({
        noteId: note.noteId,
        route: note.routing.fullPath,
        slug: note.routing.slug,
        content: note.content,
        resolvedWikilinks: simplifyResolvedWikilinks(note.resolvedWikilinks),
      }))
      .sort((left, right) => left.noteId.localeCompare(right.noteId));
  }

  async function publishScenario(
    envName: string,
    notes: PublishableNote[],
    options: {
      apiOwnedDeterministicNoteTransformsEnabled: boolean;
      allCollectedRoutes?: string[];
    }
  ): Promise<{
    manifest: Manifest | null;
    htmlByRoute: Record<string, string>;
  }> {
    const env = await createEnvironment(envName);
    const createResult = await env.createSessionHandler.handle({
      notesPlanned: notes.length,
      assetsPlanned: 0,
      batchConfig: { maxBytesPerRequest: 1024 * 1024 },
      ignoreRules: deterministicTransformParityIgnoreRules,
      apiOwnedDeterministicNoteTransformsEnabled:
        options.apiOwnedDeterministicNoteTransformsEnabled,
    });

    await env.uploadNotesHandler.handle({
      sessionId: createResult.sessionId,
      notes: buildUploadSessionNotes(notes, options.apiOwnedDeterministicNoteTransformsEnabled),
      apiOwnedDeterministicNoteTransformsEnabled:
        options.apiOwnedDeterministicNoteTransformsEnabled,
    });

    await env.finishSessionHandler.handle({
      sessionId: createResult.sessionId,
      notesProcessed: notes.length,
      assetsProcessed: 0,
      allCollectedRoutes: options.allCollectedRoutes,
    });

    const jobId = await env.finalizationJobService.queueFinalization(createResult.sessionId);
    await waitForJob(env.finalizationJobService, jobId);

    const manifest = await env.manifestFileSystem.load();
    return {
      manifest,
      htmlByRoute: await readPublishedHtml(env.contentRoot, manifest),
    };
  }

  for (const fixture of deterministicTransformParityFixtures) {
    it(`preserves final output parity for ${fixture.id}`, async () => {
      const pluginOwnedNotes = deduplicateNotesService.process(
        await buildParseHandler('plugin').handle(fixture.notes)
      );
      const apiPreparedNotes = await buildParseHandler('api').handle(fixture.notes);

      expect(simplifyNotes(apiPreparedNotes)).not.toEqual(simplifyNotes(pluginOwnedNotes));

      const pluginOwnedResult = await publishScenario(
        `${fixture.id}-plugin-owned`,
        pluginOwnedNotes,
        {
          apiOwnedDeterministicNoteTransformsEnabled: false,
          allCollectedRoutes: pluginOwnedNotes.map((note) => note.routing.fullPath),
        }
      );
      const apiOwnedResult = await publishScenario(`${fixture.id}-api-owned`, apiPreparedNotes, {
        apiOwnedDeterministicNoteTransformsEnabled: true,
      });

      expect(simplifyManifest(apiOwnedResult.manifest)).toEqual(
        simplifyManifest(pluginOwnedResult.manifest)
      );
      expect(apiOwnedResult.htmlByRoute).toEqual(pluginOwnedResult.htmlByRoute);

      for (const ignoredNoteId of fixture.ignoredNoteIds) {
        expect(apiOwnedResult.manifest?.pages.some((page) => page.id === ignoredNoteId)).toBe(
          false
        );
        expect(pluginOwnedResult.manifest?.pages.some((page) => page.id === ignoredNoteId)).toBe(
          false
        );
      }
    });
  }
});
