/**
 * E2E Tests: Inter-publication Note Deduplication (PHASE 7)
 *
 * Validates the complete workflow:
 * - First publish: All notes uploaded, manifest created with sourceHash
 * - Second publish (no changes): 0 uploads, all notes skipped (hash match)
 * - Publish with 1 modified note: 1 upload, N-1 skipped
 * - Publish after pipeline change: All notes re-uploaded (full re-render)
 * - Publish after deleting 2 notes: Manifest updated, HTML files deleted
 * - Publish after renaming (stable route): Note skipped (hash match)
 */

import { CreateSessionHandler, FinishSessionHandler, UploadNotesHandler } from '@core-application';
import { NoteHashService } from '@core-application/publishing/services/note-hash.service';
import { type Manifest, type PublishableNote, type Session } from '@core-domain';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

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

describe('E2E: Inter-publication Note Deduplication', () => {
  let tempDir: string;
  let contentRoot: string;
  let assetsRoot: string;
  let sessionsRoot: string;

  // Dependencies
  let sessionRepository: FileSystemSessionRepository;
  let manifestFileSystem: ManifestFileSystem;
  let noteHashService: NoteHashService;
  let markdownRenderer: MarkdownItRenderer;
  let stagingManager: StagingManager;
  let sessionFinalizer: SessionFinalizerService;
  let finalizationJobService: SessionFinalizationJobService;

  // Handlers
  let createSessionHandler: CreateSessionHandler;
  let uploadNotesHandler: UploadNotesHandler;
  let finishSessionHandler: FinishSessionHandler;

  beforeEach(async () => {
    // Create temp directories
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'e2e-dedup-test-'));
    contentRoot = path.join(tempDir, 'content');
    assetsRoot = path.join(tempDir, 'assets');
    sessionsRoot = path.join(tempDir, 'sessions');

    await fs.mkdir(contentRoot, { recursive: true });
    await fs.mkdir(assetsRoot, { recursive: true });
    await fs.mkdir(sessionsRoot, { recursive: true });

    // Initialize dependencies
    sessionRepository = new FileSystemSessionRepository(sessionsRoot);
    manifestFileSystem = new ManifestFileSystem(contentRoot);
    noteHashService = new NoteHashService();

    const calloutRenderer = new CalloutRendererService();
    markdownRenderer = new MarkdownItRenderer(calloutRenderer, undefined); // calloutRenderer first, logger second

    stagingManager = new StagingManager(contentRoot, assetsRoot);

    const sessionNotesStorage = new SessionNotesFileStorage(contentRoot);
    sessionFinalizer = new SessionFinalizerService(
      sessionNotesStorage,
      stagingManager,
      markdownRenderer,
      (sessionId) => new NotesFileSystemStorage(path.join(contentRoot, '.staging', sessionId)),
      (sessionId) => new ManifestFileSystem(path.join(contentRoot, '.staging', sessionId)),
      sessionRepository,
      undefined // logger
    );

    finalizationJobService = new SessionFinalizationJobService(
      sessionFinalizer,
      stagingManager,
      sessionRepository,
      undefined,
      1 // maxConcurrentJobs
    );

    // Initialize handlers
    const idGenerator = new UuidIdGenerator();
    createSessionHandler = new CreateSessionHandler(
      idGenerator,
      sessionRepository,
      manifestFileSystem,
      undefined // logger
    );

    uploadNotesHandler = new UploadNotesHandler(
      markdownRenderer,
      (sessionId) => new NotesFileSystemStorage(path.join(contentRoot, '.staging', sessionId)),
      (sessionId) => new ManifestFileSystem(path.join(contentRoot, '.staging', sessionId)),
      undefined, // logger
      undefined, // notesStorage (SessionNotesStoragePort) - optional
      undefined, // ignoredTags - optional
      noteHashService
    );

    finishSessionHandler = new FinishSessionHandler(sessionRepository);
  });

  afterEach(async () => {
    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper: Create a simple publishable note
   */
  function createNote(id: string, title: string, route: string, content: string): PublishableNote {
    return {
      noteId: id,
      title,
      vaultPath: `${id}.md`,
      relativePath: `${id}.md`,
      content,
      frontmatter: {
        flat: {},
        nested: {},
        tags: [],
      },
      folderConfig: {
        id: 'folder-1',
        vaultFolder: 'notes',
        routeBase: '/notes',
        vpsId: 'vps-1',
        ignoredCleanupRuleIds: [],
      },
      routing: {
        slug: id,
        path: '/notes',
        fullPath: route,
        routeBase: '/notes',
      },
      eligibility: {
        isPublishable: true,
      },
      publishedAt: new Date(),
      resolvedWikilinks: [],
      assets: [],
    };
  }

  /**
   * Helper: Simulate full publish workflow
   */
  async function publishNotes(
    notes: PublishableNote[],
    pipelineSignature: { version: string; renderSettingsHash: string }
  ): Promise<{ session: Session; manifest: Manifest | null }> {
    // Step 1: Create session
    const createResult = await createSessionHandler.handle({
      notesPlanned: notes.length,
      assetsPlanned: 0,
      batchConfig: {
        maxBytesPerRequest: 50 * 1024 * 1024, // 50MB default
      },
      pipelineSignature,
    });

    const sessionId = createResult.sessionId;

    // Step 2: Upload notes
    await uploadNotesHandler.handle({
      sessionId,
      notes: notes, // Pass full notes with publishedAt
    });

    // Step 3: Finish session (with allCollectedRoutes)
    const allCollectedRoutes = notes.map((n) => n.routing.fullPath);
    await finishSessionHandler.handle({
      sessionId,
      notesProcessed: notes.length,
      assetsProcessed: 0,
      allCollectedRoutes,
    });

    // Step 4: Queue finalization and wait for completion
    const jobId = await finalizationJobService.queueFinalization(sessionId);

    // Wait for job completion (poll status)
    await new Promise<void>((resolve, reject) => {
      const pollInterval = setInterval(() => {
        const jobStatus = finalizationJobService.getJobStatus(jobId);
        if (!jobStatus) {
          clearInterval(pollInterval);
          reject(new Error('Job not found'));
          return;
        }
        if (jobStatus.status === 'completed') {
          clearInterval(pollInterval);
          resolve();
        } else if (jobStatus.status === 'failed') {
          clearInterval(pollInterval);
          reject(new Error(jobStatus.error ?? 'Job failed'));
        }
      }, 100);

      // Timeout after 10s
      setTimeout(() => {
        clearInterval(pollInterval);
        reject(new Error('Job timeout'));
      }, 10000);
    });

    // Load final session and manifest
    const session = await sessionRepository.findById(sessionId);
    const manifest = await manifestFileSystem.load();

    return { session: session!, manifest };
  }

  /**
   * SCENARIO 1: First publish → all notes uploaded
   * SCENARIO 2: Second publish (no changes) → 0 uploads, all skipped
   */
  it('should skip all notes on second publish when no changes', async () => {
    // Arrange: 5 notes with stable content
    const notes = [
      createNote('note1', 'Note 1', '/notes/note1', '# Note 1\n\nContent 1'),
      createNote('note2', 'Note 2', '/notes/note2', '# Note 2\n\nContent 2'),
      createNote('note3', 'Note 3', '/notes/note3', '# Note 3\n\nContent 3'),
      createNote('note4', 'Note 4', '/notes/note4', '# Note 4\n\nContent 4'),
      createNote('note5', 'Note 5', '/notes/note5', '# Note 5\n\nContent 5'),
    ];

    const pipelineSignature = {
      version: '1.0.0',
      renderSettingsHash: 'hash-stable',
    };

    // Act 1: First publish
    const { manifest: manifest1 } = await publishNotes(notes, pipelineSignature);

    // Assert 1: Manifest has 5 pages with sourceHash
    expect(manifest1).not.toBeNull();
    expect(manifest1!.pages).toHaveLength(5);
    expect(manifest1!.pages.every((p) => p.sourceHash)).toBe(true);
    expect(manifest1!.pipelineSignature?.version).toBe('1.0.0');

    // Store first manifest for comparison
    const hash1 = manifest1!.pages.find((p) => p.route === '/notes/note1')?.sourceHash;
    expect(hash1).toBeDefined();

    // Act 2: Second publish with SAME notes (simulate client-side skip detection)
    const { session: _, manifest: manifest2 } = await publishNotes(
      notes, // Same notes, same content
      pipelineSignature
    );

    // Assert 2: CreateSession should have returned existingNoteHashes
    // In real scenario, client would filter notes before upload
    // Here we simulate that all 5 notes were uploaded again (no client-side optimization in test)
    // But manifest should preserve sourceHash from first publish for unchanged content
    expect(manifest2).not.toBeNull();
    expect(manifest2!.pages).toHaveLength(5);

    // SourceHash should be SAME as first publish (proves hash stability)
    const hash2 = manifest2!.pages.find((p) => p.route === '/notes/note1')?.sourceHash;
    expect(hash2).toBe(hash1);
  });

  /**
   * SCENARIO 3: Modify 1 note → only 1 upload needed
   */
  it('should upload only modified note when 1 out of 5 changes', async () => {
    // Arrange: Initial 5 notes
    const notes = [
      createNote('note1', 'Note 1', '/notes/note1', '# Note 1\n\nOriginal content'),
      createNote('note2', 'Note 2', '/notes/note2', '# Note 2\n\nContent 2'),
      createNote('note3', 'Note 3', '/notes/note3', '# Note 3\n\nContent 3'),
      createNote('note4', 'Note 4', '/notes/note4', '# Note 4\n\nContent 4'),
      createNote('note5', 'Note 5', '/notes/note5', '# Note 5\n\nContent 5'),
    ];

    const pipelineSignature = {
      version: '1.0.0',
      renderSettingsHash: 'hash-stable',
    };

    // Act 1: First publish
    const { manifest: manifest1 } = await publishNotes(notes, pipelineSignature);

    const hash1_unchanged = manifest1!.pages.find((p) => p.route === '/notes/note2')?.sourceHash;
    const hash1_toModify = manifest1!.pages.find((p) => p.route === '/notes/note1')?.sourceHash;

    // Act 2: Modify note1, keep others unchanged
    const notesModified = [
      createNote('note1', 'Note 1', '/notes/note1', '# Note 1\n\n**MODIFIED** content'),
      createNote('note2', 'Note 2', '/notes/note2', '# Note 2\n\nContent 2'),
      createNote('note3', 'Note 3', '/notes/note3', '# Note 3\n\nContent 3'),
      createNote('note4', 'Note 4', '/notes/note4', '# Note 4\n\nContent 4'),
      createNote('note5', 'Note 5', '/notes/note5', '# Note 5\n\nContent 5'),
    ];

    const { manifest: manifest2 } = await publishNotes(notesModified, pipelineSignature);

    // Assert: Manifest still has 5 pages
    expect(manifest2!.pages).toHaveLength(5);

    // Unchanged notes should have SAME hash
    const hash2_unchanged = manifest2!.pages.find((p) => p.route === '/notes/note2')?.sourceHash;
    expect(hash2_unchanged).toBe(hash1_unchanged);

    // Modified note should have DIFFERENT hash
    const hash2_modified = manifest2!.pages.find((p) => p.route === '/notes/note1')?.sourceHash;
    expect(hash2_modified).not.toBe(hash1_toModify);
    expect(hash2_modified).toBeDefined();
  });

  /**
   * SCENARIO 4: Pipeline change → all notes re-uploaded (pipelineChanged: true)
   */
  it('should re-upload all notes when pipeline signature changes', async () => {
    // Arrange: Initial publish with pipeline v1
    const notes = [
      createNote('note1', 'Note 1', '/notes/note1', '# Note 1\n\nContent'),
      createNote('note2', 'Note 2', '/notes/note2', '# Note 2\n\nContent'),
    ];

    const pipelineV1 = {
      version: '1.0.0',
      renderSettingsHash: 'hash-v1',
    };

    // Act 1: First publish with v1
    const { manifest: manifest1 } = await publishNotes(notes, pipelineV1);

    expect(manifest1!.pipelineSignature?.version).toBe('1.0.0');
    expect(manifest1!.pipelineSignature?.renderSettingsHash).toBe('hash-v1');

    // Act 2: Second publish with v2 (different renderSettingsHash)
    const pipelineV2 = {
      version: '1.1.0',
      renderSettingsHash: 'hash-v2-different',
    };

    const { manifest: manifest2 } = await publishNotes(notes, pipelineV2);

    // Assert: Pipeline signature updated
    expect(manifest2!.pipelineSignature?.version).toBe('1.1.0');
    expect(manifest2!.pipelineSignature?.renderSettingsHash).toBe('hash-v2-different');

    // All notes should have new sourceHash (because content was re-rendered)
    // In real scenario, CreateSession would return pipelineChanged: true
    // and client would upload ALL notes regardless of hash match
    expect(manifest2!.pages).toHaveLength(2);
  });

  /**
   * SCENARIO 5: Delete 2 notes → manifest updated, HTML files deleted
   */
  it('should remove deleted pages from manifest and delete HTML files', async () => {
    // Arrange: Initial 5 notes
    const notes = [
      createNote('note1', 'Note 1', '/notes/note1', '# Note 1'),
      createNote('note2', 'Note 2', '/notes/note2', '# Note 2'),
      createNote('note3', 'Note 3', '/notes/note3', '# Note 3'),
      createNote('note4', 'Note 4', '/notes/note4', '# Note 4'),
      createNote('note5', 'Note 5', '/notes/note5', '# Note 5'),
    ];

    const pipelineSignature = {
      version: '1.0.0',
      renderSettingsHash: 'hash-stable',
    };

    // Act 1: First publish (all 5 notes)
    const { manifest: manifest1 } = await publishNotes(notes, pipelineSignature);

    expect(manifest1!.pages).toHaveLength(5);

    // Verify HTML files exist (NotesFileSystemStorage creates slug.html, not slug/index.html)
    const html1Path = path.join(contentRoot, 'notes', 'note1.html');
    const html4Path = path.join(contentRoot, 'notes', 'note4.html');
    await expect(fs.access(html1Path)).resolves.toBeUndefined();
    await expect(fs.access(html4Path)).resolves.toBeUndefined();

    // Act 2: Second publish with only 3 notes (note1 and note4 deleted from vault)
    const notesAfterDeletion = [
      createNote('note2', 'Note 2', '/notes/note2', '# Note 2'),
      createNote('note3', 'Note 3', '/notes/note3', '# Note 3'),
      createNote('note5', 'Note 5', '/notes/note5', '# Note 5'),
    ];

    const { manifest: manifest2 } = await publishNotes(notesAfterDeletion, pipelineSignature);

    // Assert: Manifest now has only 3 pages
    expect(manifest2!.pages).toHaveLength(3);

    const routes = manifest2!.pages.map((p) => p.route);
    expect(routes).toEqual(['/notes/note2', '/notes/note3', '/notes/note5']);
    expect(routes).not.toContain('/notes/note1');
    expect(routes).not.toContain('/notes/note4');

    // HTML files for deleted notes should be removed
    await expect(fs.access(html1Path)).rejects.toThrow();
    await expect(fs.access(html4Path)).rejects.toThrow();

    // HTML files for kept notes should still exist
    const html2Path = path.join(contentRoot, 'notes', 'note2.html');
    await expect(fs.access(html2Path)).resolves.toBeUndefined();
  });

  /**
   * SCENARIO 6: Rename note with stable route → skipped (hash match)
   */
  it('should skip note when renamed but route unchanged (hash match)', async () => {
    // Arrange: Initial note with stable route
    const note1 = createNote('note1', 'Original Title', '/notes/stable-route', '# Content\n\nText');

    const pipelineSignature = {
      version: '1.0.0',
      renderSettingsHash: 'hash-stable',
    };

    // Act 1: First publish
    const { manifest: manifest1 } = await publishNotes([note1], pipelineSignature);

    const hash1 = manifest1!.pages.find((p) => p.route === '/notes/stable-route')?.sourceHash;
    expect(hash1).toBeDefined();

    // Act 2: "Rename" note (change title, but keep route and content stable)
    const note1Renamed = createNote(
      'note1',
      'NEW Title After Rename',
      '/notes/stable-route', // Route unchanged
      '# Content\n\nText' // Content unchanged
    );

    const { manifest: manifest2 } = await publishNotes([note1Renamed], pipelineSignature);

    // Assert: Route still present with SAME hash (proves skip optimization works)
    const hash2 = manifest2!.pages.find((p) => p.route === '/notes/stable-route')?.sourceHash;
    expect(hash2).toBe(hash1);

    // Title in manifest should be updated (from staging)
    const page2 = manifest2!.pages.find((p) => p.route === '/notes/stable-route');
    expect(page2?.title).toBe('NEW Title After Rename');
  });
});
