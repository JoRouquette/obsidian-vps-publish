import fs from 'node:fs/promises';
import path from 'node:path';

import { type LoggerPort, type Manifest } from '@core-domain';
import { Mutex } from 'async-mutex';

/**
 * Gère le cycle de vie du répertoire de staging pour une session.
 * - Chaque session écrit dans /content/.staging/<sessionId> et /assets/.staging/<sessionId>.
 * - Lors du finish (non aborted), on nettoie la racine et on promeut le staging en production.
 */
export class StagingManager {
  private readonly promotionMutex = new Mutex();

  constructor(
    private readonly contentRoot: string,
    private readonly assetsRoot: string,
    private readonly logger?: LoggerPort
  ) {}

  /** Getter pour accéder au contentRoot (utile pour slug change detection) */
  get contentRootPath(): string {
    return this.contentRoot;
  }

  contentStagingPath(sessionId: string): string {
    return path.join(this.contentRoot, '.staging', sessionId);
  }

  assetsStagingPath(sessionId: string): string {
    return path.join(this.assetsRoot, '.staging', sessionId);
  }

  /**
   * Promotes staged content to production with selective asset synchronization.
   * Content is fully replaced, but assets are synchronized based on manifest:
   * - New assets from staging are copied
   * - Existing assets referenced in manifest are preserved
   * - Obsolete assets not in manifest are deleted (cleanup)
   *
   * CRITICAL: Mutex protects the entire promotion sequence to prevent race conditions.
   * Without mutex, concurrent promotions could interleave operations:
   * - Session A clears content, Session B clears (overwrites A's partial copy)
   * - Session A copies files while Session B clears (corrupted state)
   *
   * The promotion is atomic per-session but serialized across sessions.
   */
  async promoteSession(sessionId: string): Promise<void> {
    const stagingContent = this.contentStagingPath(sessionId);
    const stagingAssets = this.assetsStagingPath(sessionId);

    await fs.mkdir(stagingContent, { recursive: true });
    await fs.mkdir(stagingAssets, { recursive: true });

    this.logger?.debug('Promoting staged content with selective asset sync', {
      sessionId,
      stagingContent,
      stagingAssets,
    });

    // Load manifest from staging to get list of referenced assets
    const manifest = await this.loadManifestFromStaging(sessionId);
    const referencedAssetPaths = new Set<string>(
      manifest?.assets?.map((asset) => asset.path) ?? []
    );

    this.logger?.debug('Manifest loaded from staging', {
      sessionId,
      referencedAssetsCount: referencedAssetPaths.size,
    });

    // CRITICAL SECTION: Entire promotion must be atomic (mutex protected)
    // Prevents race conditions from concurrent session promotions
    await this.promotionMutex.runExclusive(async () => {
      this.logger?.debug('Acquired promotion mutex, starting atomic promotion', { sessionId });

      // Step 1: Clear production content (preserves .staging)
      await this.clearRootExcept(this.contentRoot, ['.staging']);

      // Step 2: Synchronize assets (copy new, keep referenced, delete obsolete)
      await this.synchronizeAssets(stagingAssets, referencedAssetPaths);

      // Step 3: Copy staged content to production
      await this.copyDirContents(stagingContent, this.contentRoot);

      this.logger?.debug('Promotion completed atomically, releasing mutex', { sessionId });
    });

    await this.cleanupStaging(sessionId);

    this.logger?.debug('Staging promoted to production roots', { sessionId });
  }

  async discardSession(sessionId: string): Promise<void> {
    const contentStage = this.contentStagingPath(sessionId);
    const assetsStage = this.assetsStagingPath(sessionId);
    await fs.rm(contentStage, { recursive: true, force: true });
    await fs.rm(assetsStage, { recursive: true, force: true });
    this.logger?.debug('Discarded staging session', { sessionId });
  }

  /**
   * Supprime totalement le contenu et les assets (y compris le staging).
   * Le rÇ¸pertoire racine reste prÇ¸sent mais vidÇ¸.
   */
  async purgeAll(): Promise<void> {
    this.logger?.warn('Purging all content and assets from VPS');
    await this.clearRootExcept(this.contentRoot, []);
    await this.clearRootExcept(this.assetsRoot, []);
    this.logger?.debug('Content and assets purged');
  }

  private async cleanupStaging(sessionId: string) {
    const contentStage = this.contentStagingPath(sessionId);
    const assetsStage = this.assetsStagingPath(sessionId);
    await fs.rm(contentStage, { recursive: true, force: true });
    await fs.rm(assetsStage, { recursive: true, force: true });
  }

  private async clearRootExcept(root: string, keep: string[]) {
    await fs.mkdir(root, { recursive: true });
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (keep.includes(entry.name)) continue;
      const full = path.join(root, entry.name);
      await fs.rm(full, { recursive: true, force: true });
    }
  }

  private async copyDirContents(src: string, dest: string) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '_raw-notes') {
        this.logger?.debug('Skipping raw notes cache during promotion', { path: entry.name });
        continue;
      }
      const from = path.join(src, entry.name);
      const to = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await this.copyDirContents(from, to);
      } else if (entry.isFile()) {
        await fs.copyFile(from, to);
      }
    }
  }

  /**
   * Loads manifest from staging directory
   */
  private async loadManifestFromStaging(sessionId: string): Promise<Manifest | null> {
    const manifestPath = path.join(this.contentStagingPath(sessionId), '_manifest.json');
    try {
      const raw = await fs.readFile(manifestPath, 'utf8');
      const parsed = JSON.parse(raw) as Manifest;
      return parsed;
    } catch (err) {
      this.logger?.warn('Failed to load manifest from staging, proceeding without asset sync', {
        sessionId,
        manifestPath,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Synchronizes assets between staging and production based on manifest:
   * 1. Copy new assets from staging
   * 2. Keep existing assets referenced in manifest
   * 3. Delete obsolete assets not in manifest
   */
  private async synchronizeAssets(
    stagingAssets: string,
    referencedAssetPaths: Set<string>
  ): Promise<void> {
    const stats = {
      copied: 0,
      kept: 0,
      deleted: 0,
    };

    // Get list of assets currently in production
    const productionAssetsList = await this.listAllFiles(this.assetsRoot, ['.staging']);
    const productionAssets = new Set(productionAssetsList);

    // Get list of assets in staging
    const stagingAssetsList = await this.listAllFiles(stagingAssets, []);

    // Copy new assets from staging to production
    for (const relativePath of stagingAssetsList) {
      const from = path.join(stagingAssets, relativePath);
      const to = path.join(this.assetsRoot, relativePath);
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.copyFile(from, to);
      stats.copied++;
    }

    // Delete obsolete assets from production (not in manifest and not in staging)
    for (const relativePath of productionAssets) {
      // Normalize path to match manifest format (use forward slashes)
      const normalizedPath = relativePath.split(path.sep).join('/');

      // Keep if referenced in manifest OR if it was just copied from staging
      if (referencedAssetPaths.has(normalizedPath) || stagingAssetsList.includes(relativePath)) {
        stats.kept++;
        continue;
      }

      // Delete obsolete asset
      const assetPath = path.join(this.assetsRoot, relativePath);
      await fs.rm(assetPath, { force: true });
      stats.deleted++;

      this.logger?.debug('Deleted obsolete asset', {
        path: relativePath,
        normalizedPath,
      });
    }

    this.logger?.info('Asset synchronization completed', stats);
  }

  /**
   * Lists all files recursively in a directory, returning relative paths
   */
  private async listAllFiles(dir: string, excludeDirs: string[]): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (excludeDirs.includes(entry.name)) {
          continue;
        }

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const subFiles = await this.listAllFiles(fullPath, excludeDirs);
          files.push(...subFiles.map((f) => path.join(entry.name, f)));
        } else if (entry.isFile()) {
          files.push(entry.name);
        }
      }
    } catch (err) {
      // Directory might not exist yet, return empty array
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger?.warn('Error listing files', {
          dir,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return files;
  }
}
