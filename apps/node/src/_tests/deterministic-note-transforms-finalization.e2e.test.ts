import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildUploadSessionNotes,
  CreateSessionHandler,
  DeterministicNoteTransformsService,
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
import { DetectAssetsService } from '@core-application/vault-parsing/services/detect-assets.service';
import { DetectLeafletBlocksService } from '@core-application/vault-parsing/services/detect-leaflet-blocks.service';
import { NormalizeFrontmatterService } from '@core-application/vault-parsing/services/normalize-frontmatter.service';
import { RemoveNoPublishingMarkerService } from '@core-application/vault-parsing/services/remove-no-publishing-marker.service';
import { RenderInlineDataviewService } from '@core-application/vault-parsing/services/render-inline-dataview.service';
import { type Manifest, type PublishableNote } from '@core-domain';
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

describe('Deterministic note transform finalization', () => {
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

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deterministic-transforms-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function buildParseHandler() {
    return new ParseContentHandler(
      new NormalizeFrontmatterService(noopLogger),
      new EvaluateIgnoreRulesHandler(deterministicTransformParityIgnoreRules, noopLogger),
      new NotesMapper(),
      new RenderInlineDataviewService(noopLogger),
      new DetectLeafletBlocksService(noopLogger),
      new RemoveNoPublishingMarkerService(noopLogger),
      new DetectAssetsService(noopLogger),
      noopLogger
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

    return {
      contentRoot,
      createSessionHandler: new CreateSessionHandler(
        new UuidIdGenerator(),
        sessionRepository,
        manifestFileSystem,
        undefined
      ),
      uploadNotesHandler: new UploadNotesHandler(
        markdownRenderer,
        (sessionId) => new NotesFileSystemStorage(path.join(contentRoot, '.staging', sessionId)),
        (sessionId) => new ManifestFileSystem(path.join(contentRoot, '.staging', sessionId)),
        undefined,
        sessionNotesStorage
      ),
      finishSessionHandler: new FinishSessionHandler(sessionRepository),
      finalizationJobService,
      manifestFileSystem,
    };
  }

  async function waitForJob(
    finalizationJobService: SessionFinalizationJobService,
    jobId: string
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        clearInterval(poll);
        reject(new Error('Timed out waiting for finalization'));
      }, 10000);

      const poll = setInterval(() => {
        const job = finalizationJobService.getJobStatus(jobId);
        if (!job) {
          clearInterval(poll);
          clearTimeout(timeoutId);
          reject(new Error('Job not found'));
          return;
        }

        if (job.status === 'completed') {
          clearInterval(poll);
          clearTimeout(timeoutId);
          resolve();
          return;
        }

        if (job.status === 'failed') {
          clearInterval(poll);
          clearTimeout(timeoutId);
          reject(new Error(job.error ?? 'Finalization failed'));
        }
      }, 50);
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

  function simplifyExpected(notes: PublishableNote[]) {
    return notes
      .map((note) => ({
        id: note.noteId,
        title: note.title,
        route: note.routing.fullPath,
        aliases: Array.isArray(note.frontmatter.flat.aliases)
          ? note.frontmatter.flat.aliases
          : typeof note.frontmatter.flat.aliases === 'string'
            ? [note.frontmatter.flat.aliases]
            : [],
      }))
      .sort((left, right) => left.route.localeCompare(right.route));
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

  async function publishScenario(envName: string, notes: PublishableNote[]) {
    const env = await createEnvironment(envName);
    const createResult = await env.createSessionHandler.handle({
      notesPlanned: notes.length,
      assetsPlanned: 0,
      batchConfig: { maxBytesPerRequest: 1024 * 1024 },
      ignoreRules: deterministicTransformParityIgnoreRules,
    });

    await env.uploadNotesHandler.handle({
      sessionId: createResult.sessionId,
      notes: buildUploadSessionNotes(notes),
    });

    await env.finishSessionHandler.handle({
      sessionId: createResult.sessionId,
      notesProcessed: notes.length,
      assetsProcessed: 0,
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
    it(`publishes the canonical deterministic output for ${fixture.id}`, async () => {
      const preparedNotes = await buildParseHandler().handle(fixture.notes);
      const expectedNotes = await new DeterministicNoteTransformsService(noopLogger).process(
        preparedNotes,
        {
          deduplicationEnabled: true,
          ignoreRulesAlreadyApplied: true,
        }
      );

      const result = await publishScenario(fixture.id, preparedNotes);

      expect(simplifyManifest(result.manifest)).toEqual(simplifyExpected(expectedNotes));
      expect(Object.keys(result.htmlByRoute).sort()).toEqual(
        expectedNotes.map((note) => note.routing.fullPath).sort()
      );

      for (const note of expectedNotes) {
        expect(result.htmlByRoute[note.routing.fullPath]).toContain(note.title);
        expect(result.htmlByRoute[note.routing.fullPath]).not.toContain('```dataview');
      }

      for (const ignoredNoteId of fixture.ignoredNoteIds) {
        expect(result.manifest?.pages.some((page) => page.id === ignoredNoteId)).toBe(false);
      }
    });
  }
});
