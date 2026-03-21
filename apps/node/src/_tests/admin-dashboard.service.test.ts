import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Slug } from '@core-domain';

import { AdminDashboardService } from '../infra/admin/admin-dashboard.service';
import { AdminRuntimeControlService } from '../infra/admin/admin-runtime-control.service';
import { EnvConfig } from '../infra/config/env-config';
import { ContentVersionService } from '../infra/content-version/content-version.service';
import { FileSystemSessionRepository } from '../infra/filesystem/file-system-session.repository';
import { ManifestFileSystem } from '../infra/filesystem/manifest-file-system';

const ORIGINAL_ENV = { ...process.env };

describe('AdminDashboardService', () => {
  const originalCwd = process.cwd();
  let tempDir: string;
  let logFilePath: string;
  let manifestStorage: ManifestFileSystem;
  let contentVersionService: ContentVersionService;
  let sessionRepository: FileSystemSessionRepository;
  let runtimeControl: AdminRuntimeControlService;
  let finalizationJobService: {
    getPersistedHistory: jest.Mock<Promise<[]>, []>;
    getRecentJobs: jest.Mock<[], [number?]>;
    getQueueStats: jest.Mock<
      {
        totalJobs: number;
        pending: number;
        processing: number;
        completed: number;
        failed: number;
        queueLength: number;
        activeJobs: number;
        maxConcurrentJobs: number;
      },
      []
    >;
  };

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'admin-dashboard-'));
    logFilePath = path.join(tempDir, 'node.log');
    process.env.CONTENT_ROOT = tempDir;
    process.env.ASSETS_ROOT = tempDir;
    process.env.LOG_FILE_PATH = logFilePath;
    process.env.NODE_ENV = 'test';
    process.env.LOGGER_LEVEL = 'debug';

    manifestStorage = new ManifestFileSystem(tempDir);
    await manifestStorage.save({
      sessionId: 'session-1',
      createdAt: new Date('2026-03-20T10:00:00.000Z'),
      lastUpdatedAt: new Date('2026-03-21T08:15:00.000Z'),
      contentRevision: 'rev-42',
      pages: [
        {
          id: 'page-1',
          title: 'Admin Page',
          slug: Slug.from('admin-page'),
          route: '/admin-page',
          publishedAt: new Date('2026-03-21T08:00:00.000Z'),
        },
      ],
      assets: [
        {
          path: '/assets/image.webp',
          hash: 'hash-1',
          size: 1234,
          mimeType: 'image/webp',
          uploadedAt: new Date('2026-03-21T08:05:00.000Z'),
        },
      ],
    });

    contentVersionService = new ContentVersionService(tempDir);
    sessionRepository = new FileSystemSessionRepository(tempDir);
    runtimeControl = new AdminRuntimeControlService();
    finalizationJobService = {
      getPersistedHistory: jest.fn().mockResolvedValue([]),
      getRecentJobs: jest.fn().mockReturnValue([]),
      getQueueStats: jest.fn().mockReturnValue({
        totalJobs: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        queueLength: 0,
        activeJobs: 0,
        maxConcurrentJobs: 8,
      }),
    };
    await contentVersionService.updateVersion();
    await fs.writeFile(path.join(tempDir, 'admin-page.html'), '<html>Admin Page</html>', 'utf8');
    await fs.writeFile(path.join(tempDir, 'image.webp'), 'asset', 'utf8');

    await fs.writeFile(
      logFilePath,
      [
        JSON.stringify({
          level: 'info',
          message: 'Server started',
          timestamp: '2026-03-21T08:10:00.000Z',
        }),
        JSON.stringify({
          level: 'warn',
          message: 'Slow request detected',
          route: '/content/page',
          timestamp: '2026-03-21T08:11:00.000Z',
        }),
        JSON.stringify({
          level: 'error',
          message: 'Finalization failed',
          sessionId: 'session-1',
          timestamp: '2026-03-21T08:12:00.000Z',
        }),
      ].join('\n'),
      'utf8'
    );
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    process.env = { ...ORIGINAL_ENV };
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('builds a dashboard snapshot with publication and notifications', async () => {
    const service = new AdminDashboardService(
      manifestStorage,
      contentVersionService,
      sessionRepository,
      finalizationJobService as never,
      runtimeControl,
      undefined,
      undefined,
      undefined,
      EnvConfig
    );

    const snapshot = await service.getSnapshot();

    expect(snapshot.publication.pagesCount).toBe(1);
    expect(snapshot.publication.assetsCount).toBe(1);
    expect(snapshot.publication.contentRevision).toBe('rev-42');
    expect(snapshot.server.logFilePath).toBe(logFilePath);
    expect(snapshot.notifications.map((item) => item.level)).toEqual(['error', 'warn']);
  });

  it('returns a filtered log tail ordered from newest to oldest', async () => {
    const service = new AdminDashboardService(
      manifestStorage,
      contentVersionService,
      sessionRepository,
      finalizationJobService as never,
      runtimeControl,
      undefined,
      undefined,
      undefined,
      EnvConfig
    );

    const logs = await service.getLogTail(5, 'warn');

    expect(logs.totalReturned).toBe(2);
    expect(logs.lines[0].message).toBe('Finalization failed');
    expect(logs.lines[1].message).toBe('Slow request detected');
  });

  it('checks published page files from routes instead of source markdown paths', async () => {
    await manifestStorage.save({
      sessionId: 'session-1',
      createdAt: new Date('2026-03-20T10:00:00.000Z'),
      lastUpdatedAt: new Date('2026-03-21T09:00:00.000Z'),
      contentRevision: 'rev-42',
      pages: [
        {
          id: 'page-1',
          title: 'Nested Admin Page',
          slug: Slug.from('nested-admin-page'),
          route: '/nested/admin-page',
          relativePath: 'notes/admin-page.md',
          publishedAt: new Date('2026-03-21T08:00:00.000Z'),
        },
      ],
      assets: [],
    });
    await fs.mkdir(path.join(tempDir, 'nested'), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, 'nested', 'admin-page.html'),
      '<html>Nested Admin Page</html>',
      'utf8'
    );

    const service = new AdminDashboardService(
      manifestStorage,
      contentVersionService,
      sessionRepository,
      finalizationJobService as never,
      runtimeControl,
      undefined,
      undefined,
      undefined,
      EnvConfig
    );

    const snapshot = await service.getSnapshot();

    expect(snapshot.diagnostics.manifest.missingPageFiles).toBe(0);
    expect(
      snapshot.diagnostics.messages.some((message) => message.includes('pages du manifest'))
    ).toBe(false);
  });

  it('falls back to the legacy root log file when the configured path is missing', async () => {
    process.chdir(tempDir);
    const configuredLogPath = path.join(tempDir, 'tmp', 'logs', 'node.log');
    const legacyLogPath = path.join(tempDir, 'node.log');
    process.env.LOG_FILE_PATH = './tmp/logs/node.log';
    await fs.writeFile(
      legacyLogPath,
      JSON.stringify({
        level: 'error',
        message: 'Legacy log still active',
        timestamp: '2026-03-21T10:00:00.000Z',
      }),
      'utf8'
    );

    const service = new AdminDashboardService(
      manifestStorage,
      contentVersionService,
      sessionRepository,
      finalizationJobService as never,
      runtimeControl,
      undefined,
      undefined,
      undefined,
      {
        nodeEnv: () => 'test',
        loggerLevel: () => 'debug',
        logFilePath: () => configuredLogPath,
        contentRoot: () => tempDir,
        assetsRoot: () => tempDir,
      } as typeof EnvConfig
    );

    const [logs, snapshot] = await Promise.all([service.getLogTail(5), service.getSnapshot()]);

    expect(logs.logFilePath).toBe(legacyLogPath);
    expect(logs.lines[0].message).toBe('Legacy log still active');
    expect(snapshot.server.logFilePath).toBe(legacyLogPath);
    expect(snapshot.diagnostics.messages).not.toContain('Le fichier de log actif est introuvable.');
  });
});
