import fs from 'node:fs/promises';
import path from 'node:path';

import { type LoggerPort, type Manifest, type ManifestPage } from '@core-domain';
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
   * Promotes staged content to production with manifest merge and selective synchronization.
   *
   * Key features:
   * - Manifest merge: staging pages + unchanged production pages (inter-publication deduplication)
   * - HTML cleanup: deleted pages' HTML files are removed
   * - Asset sync: new assets copied, referenced assets kept, obsolete deleted
   * - Pipeline signature: updated from session or staging manifest
   *
   * CRITICAL: Mutex protects the entire promotion sequence to prevent race conditions.
   *
   * @param sessionId - Session identifier
   * @param allCollectedRoutes - All routes collected from vault (PHASE 6.1), used to detect deleted pages
   * @param pipelineSignature - Pipeline signature from session (PHASE 7 fix)
   */
  async promoteSession(
    sessionId: string,
    allCollectedRoutes?: string[],
    pipelineSignature?: unknown
  ): Promise<void> {
    const stagingContent = this.contentStagingPath(sessionId);
    const stagingAssets = this.assetsStagingPath(sessionId);

    await fs.mkdir(stagingContent, { recursive: true });
    await fs.mkdir(stagingAssets, { recursive: true });

    this.logger?.debug('Promoting staged content with manifest merge', {
      sessionId,
      stagingContent,
      stagingAssets,
      allCollectedRoutesCount: allCollectedRoutes?.length,
    });

    // CRITICAL SECTION: Entire promotion must be atomic (mutex protected)
    await this.promotionMutex.runExclusive(async () => {
      this.logger?.debug('Acquired promotion mutex, starting atomic promotion', { sessionId });

      // Step 1: Load manifests BEFORE any filesystem operations
      const productionManifest = await this.loadManifestFromProduction();
      const stagingManifest = await this.loadManifestFromStaging(sessionId);

      if (!stagingManifest) {
        throw new Error(`Staging manifest not found for session ${sessionId}`);
      }

      // Step 2: Build final manifest with merged pages
      const stagingRoutes = new Set(stagingManifest.pages.map((p) => p.route));

      // Keep production pages whose routes are NOT in staging (unchanged notes)
      // PHASE 6.1: If allCollectedRoutes provided, also filter by presence in vault
      let unchangedPages: ManifestPage[] = [];

      if (allCollectedRoutes) {
        const collectedRoutesSet = new Set(allCollectedRoutes);
        // Only keep production pages that are:
        // 1. NOT in staging (not modified)
        // 2. Still present in vault (in allCollectedRoutes)
        unchangedPages =
          productionManifest?.pages.filter(
            (p) => !stagingRoutes.has(p.route) && collectedRoutesSet.has(p.route)
          ) ?? [];
      } else {
        // Fallback: keep all production pages not in staging (conservative)
        unchangedPages = productionManifest?.pages.filter((p) => !stagingRoutes.has(p.route)) ?? [];
      }

      const finalManifest: Manifest = {
        ...stagingManifest,
        pages: [
          ...stagingManifest.pages, // New/updated pages from staging
          ...unchangedPages, // Unchanged pages from production
        ],
        // Update pipelineSignature from session or staging (PHASE 7 fix)
        pipelineSignature: (pipelineSignature ?? stagingManifest.pipelineSignature) as any,
      };

      this.logger?.debug('Manifest merge prepared', {
        sessionId,
        stagingPages: stagingManifest.pages.length,
        unchangedPages: unchangedPages.length,
        finalPages: finalManifest.pages.length,
      });

      // Step 3: Detect deleted pages (PHASE 6.1: using allCollectedRoutes if available)
      const finalRoutes = new Set(finalManifest.pages.map((p) => p.route));
      let deletedPages: ManifestPage[] = [];

      if (allCollectedRoutes) {
        // PHASE 6.1: Use allCollectedRoutes to detect deleted pages
        // Deleted pages are in production but NOT in allCollectedRoutes (vault)
        const collectedRoutesSet = new Set(allCollectedRoutes);
        deletedPages =
          productionManifest?.pages.filter((p) => !collectedRoutesSet.has(p.route)) ?? [];
        this.logger?.debug('Deleted pages detection (using allCollectedRoutes)', {
          productionPages: productionManifest?.pages.length,
          collectedRoutes: allCollectedRoutes.length,
          deletedPages: deletedPages.length,
        });
      } else {
        // Fallback: deleted pages = in production but not in final
        // This is conservative (treats skipped notes as unchanged, not deleted)
        deletedPages = productionManifest?.pages.filter((p) => !finalRoutes.has(p.route)) ?? [];
        this.logger?.warn('Deleted pages detection (fallback: no allCollectedRoutes)', {
          productionPages: productionManifest?.pages.length,
          finalPages: finalManifest.pages.length,
          deletedPages: deletedPages.length,
        });
      }

      // Step 4: Delete HTML files for deleted pages
      if (deletedPages.length > 0) {
        this.logger?.info('Deleting HTML files for removed pages', {
          sessionId,
          count: deletedPages.length,
        });

        for (const page of deletedPages) {
          // Construct HTML path from route (e.g., /notes/note1 → /content/notes/note1.html)
          // NotesFileSystemStorage creates slug.html, not slug/index.html
          const routeSegments = page.route.split('/').filter(Boolean);
          const htmlPath = path.join(
            this.contentRoot,
            ...routeSegments.slice(0, -1),
            `${routeSegments[routeSegments.length - 1]}.html`
          );

          try {
            await fs.unlink(htmlPath);
            this.logger?.debug('Deleted HTML for removed page', {
              route: page.route,
              path: htmlPath,
            });
          } catch (err) {
            // File might not exist (e.g., custom index), log warning only
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
              this.logger?.warn('Failed to delete HTML for removed page', {
                route: page.route,
                path: htmlPath,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }
        }
      }

      // Step 5: Copy staged content to production (new/updated files)
      await this.copyDirContents(stagingContent, this.contentRoot);

      // Step 6: Save final manifest to production
      const finalManifestPath = path.join(this.contentRoot, '_manifest.json');
      await fs.writeFile(
        finalManifestPath,
        JSON.stringify(
          {
            ...finalManifest,
            createdAt: finalManifest.createdAt.toISOString(),
            lastUpdatedAt: finalManifest.lastUpdatedAt.toISOString(),
            pages: finalManifest.pages.map((p) => ({
              ...p,
              publishedAt: p.publishedAt.toISOString(),
            })),
            assets: finalManifest.assets?.map((a) => ({
              ...a,
              uploadedAt: a.uploadedAt.toISOString(),
            })),
          },
          null,
          2
        ),
        'utf8'
      );

      this.logger?.info('Manifest merged and saved to production', {
        sessionId,
        stagingPages: stagingManifest.pages.length,
        unchangedPages: unchangedPages.length,
        deletedPages: deletedPages.length,
        finalPages: finalManifest.pages.length,
      });

      // Step 7: Synchronize assets (copy new, keep referenced, delete obsolete)
      const referencedAssetPaths = new Set<string>(
        finalManifest.assets?.map((asset) => asset.path) ?? []
      );
      await this.synchronizeAssets(stagingAssets, referencedAssetPaths);

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
   * Loads manifest from production content root
   * Used for inter-publication note deduplication and manifest merge
   */
  private async loadManifestFromProduction(): Promise<Manifest | null> {
    const manifestPath = path.join(this.contentRoot, '_manifest.json');
    try {
      const raw = await fs.readFile(manifestPath, 'utf8');
      const parsed = JSON.parse(raw) as {
        sessionId?: string;
        createdAt?: string;
        lastUpdatedAt?: string;
        pages?: unknown[];
        folderDisplayNames?: Record<string, string>;
        canonicalMap?: Record<string, string>;
        assets?: unknown[];
        pipelineSignature?: unknown;
      };

      // Deserialize dates for pages
      const pages = Array.isArray(parsed.pages)
        ? parsed.pages.map((p: any) => ({
            ...p,
            publishedAt: new Date(p.publishedAt ?? 0),
          }))
        : [];

      // Deserialize dates for assets
      const assets = Array.isArray(parsed.assets)
        ? parsed.assets.map((a: any) => ({
            ...a,
            uploadedAt: new Date(a.uploadedAt ?? 0),
          }))
        : undefined;

      return {
        sessionId: parsed.sessionId ?? '',
        createdAt: new Date(parsed.createdAt ?? 0),
        lastUpdatedAt: new Date(parsed.lastUpdatedAt ?? 0),
        pages,
        folderDisplayNames: parsed.folderDisplayNames,
        canonicalMap: parsed.canonicalMap,
        assets,
        pipelineSignature: parsed.pipelineSignature as any,
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        this.logger?.debug('No production manifest found (first publish)');
        return null;
      }
      this.logger?.warn('Failed to load production manifest', {
        manifestPath,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Loads manifest from staging directory
   */
  private async loadManifestFromStaging(sessionId: string): Promise<Manifest | null> {
    const manifestPath = path.join(this.contentStagingPath(sessionId), '_manifest.json');
    try {
      const raw = await fs.readFile(manifestPath, 'utf8');
      const parsed = JSON.parse(raw) as {
        sessionId?: string;
        createdAt?: string;
        lastUpdatedAt?: string;
        pages?: unknown[];
        folderDisplayNames?: Record<string, string>;
        canonicalMap?: Record<string, string>;
        assets?: unknown[];
        pipelineSignature?: unknown;
      };

      // Deserialize dates for pages
      const pages = Array.isArray(parsed.pages)
        ? parsed.pages.map((p: any) => ({
            ...p,
            publishedAt: new Date(p.publishedAt ?? 0),
          }))
        : [];

      // Deserialize dates for assets
      const assets = Array.isArray(parsed.assets)
        ? parsed.assets.map((a: any) => ({
            ...a,
            uploadedAt: new Date(a.uploadedAt ?? 0),
          }))
        : undefined;

      return {
        sessionId: parsed.sessionId ?? '',
        createdAt: new Date(parsed.createdAt ?? 0),
        lastUpdatedAt: new Date(parsed.lastUpdatedAt ?? 0),
        pages,
        folderDisplayNames: parsed.folderDisplayNames,
        canonicalMap: parsed.canonicalMap,
        assets,
        pipelineSignature: parsed.pipelineSignature as any,
      };
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
