import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  CreateSessionHandler,
  EvaluateIgnoreRulesHandler,
  FinishSessionHandler,
  NotesMapper,
  ParseContentHandler,
  UploadNotesHandler,
} from '@core-application';
import { ComputeRoutingService } from '@core-application/vault-parsing/services/compute-routing.service';
import { DetectAssetsService } from '@core-application/vault-parsing/services/detect-assets.service';
import { DetectLeafletBlocksService } from '@core-application/vault-parsing/services/detect-leaflet-blocks.service';
import { DetectWikilinksService } from '@core-application/vault-parsing/services/detect-wikilinks.service';
import { EnsureTitleHeaderService } from '@core-application/vault-parsing/services/ensure-title-header.service';
import { NormalizeFrontmatterService } from '@core-application/vault-parsing/services/normalize-frontmatter.service';
import { RemoveNoPublishingMarkerService } from '@core-application/vault-parsing/services/remove-no-publishing-marker.service';
import { RenderInlineDataviewService } from '@core-application/vault-parsing/services/render-inline-dataview.service';
import { ResolveWikilinksService } from '@core-application/vault-parsing/services/resolve-wikilinks.service';
import {
  type CollectedNote,
  type IgnoreRule,
  type Manifest,
  type PublishableNote,
} from '@core-domain';
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

describe('API-owned deterministic note transforms', () => {
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
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'api-owned-transforms-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function buildParseHandler(mode: 'plugin' | 'api', ignoreRules: IgnoreRule[]) {
    const normalizeFrontmatterService = new NormalizeFrontmatterService(noopLogger);
    const evaluateIgnoreRulesHandler = new EvaluateIgnoreRulesHandler(ignoreRules, noopLogger);
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

  async function publishScenario(
    envName: string,
    notes: PublishableNote[],
    options: {
      ignoreRules: IgnoreRule[];
      apiOwnedDeterministicNoteTransformsEnabled: boolean;
      allCollectedRoutes?: string[];
    }
  ): Promise<{ manifest: Manifest | null; alphaHtml: string }> {
    const env = await createEnvironment(envName);
    const createResult = await env.createSessionHandler.handle({
      notesPlanned: notes.length,
      assetsPlanned: 0,
      batchConfig: { maxBytesPerRequest: 1024 * 1024 },
      ignoreRules: options.ignoreRules,
      apiOwnedDeterministicNoteTransformsEnabled:
        options.apiOwnedDeterministicNoteTransformsEnabled,
    });

    await env.uploadNotesHandler.handle({
      sessionId: createResult.sessionId,
      notes,
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
    const alphaHtml = await fs.readFile(path.join(env.contentRoot, 'blog', 'alpha.html'), 'utf8');

    return { manifest, alphaHtml };
  }

  it('produces equivalent final output between plugin-owned and api-owned deterministic transforms', async () => {
    const ignoreRules: IgnoreRule[] = [{ property: 'publish', ignoreIf: false } as IgnoreRule];
    const collectedNotes: CollectedNote[] = [
      {
        noteId: 'alpha',
        title: 'Alpha',
        vaultPath: 'Vault/Blog/Alpha.md',
        relativePath: 'Alpha.md',
        content: 'Link to [[Beta]] and `=this.title`',
        frontmatter: { publish: true } as any,
        folderConfig: {
          id: 'folder',
          vaultFolder: 'Vault/Blog',
          routeBase: '/blog',
          vpsId: 'vps',
          ignoredCleanupRuleIds: [],
        },
      },
      {
        noteId: 'beta',
        title: 'Beta',
        vaultPath: 'Vault/Blog/Beta.md',
        relativePath: 'Beta.md',
        content: 'Second note',
        frontmatter: { publish: true } as any,
        folderConfig: {
          id: 'folder',
          vaultFolder: 'Vault/Blog',
          routeBase: '/blog',
          vpsId: 'vps',
          ignoredCleanupRuleIds: [],
        },
      },
    ];

    const pluginOwnedNotes = await buildParseHandler('plugin', ignoreRules).handle(collectedNotes);
    const apiPreparedNotes = await buildParseHandler('api', ignoreRules).handle(collectedNotes);

    const pluginOwnedResult = await publishScenario('plugin-owned', pluginOwnedNotes, {
      ignoreRules,
      apiOwnedDeterministicNoteTransformsEnabled: false,
      allCollectedRoutes: pluginOwnedNotes.map((note) => note.routing.fullPath),
    });
    const apiOwnedResult = await publishScenario('api-owned', apiPreparedNotes, {
      ignoreRules,
      apiOwnedDeterministicNoteTransformsEnabled: true,
    });

    expect(apiOwnedResult.manifest?.pages.map((page) => page.route)).toEqual(
      pluginOwnedResult.manifest?.pages.map((page) => page.route)
    );
    expect(apiOwnedResult.alphaHtml).toEqual(pluginOwnedResult.alphaHtml);
  });
});
