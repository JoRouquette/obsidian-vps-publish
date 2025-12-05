import fs from 'node:fs/promises';
import path from 'node:path';

import { type LoggerPort } from '@core-application';

/**
 * Gère le cycle de vie du répertoire de staging pour une session.
 * - Chaque session écrit dans /content/.staging/<sessionId> et /assets/.staging/<sessionId>.
 * - Lors du finish (non aborted), on nettoie la racine et on promeut le staging en production.
 */
export class StagingManager {
  constructor(
    private readonly contentRoot: string,
    private readonly assetsRoot: string,
    private readonly logger?: LoggerPort
  ) {}

  contentStagingPath(sessionId: string): string {
    return path.join(this.contentRoot, '.staging', sessionId);
  }

  assetsStagingPath(sessionId: string): string {
    return path.join(this.assetsRoot, '.staging', sessionId);
  }

  /**
   * Supprime le contenu courant (hors .staging) et copie le staging de la session vers la racine.
   */
  async promoteSession(sessionId: string): Promise<void> {
    const stagingContent = this.contentStagingPath(sessionId);
    const stagingAssets = this.assetsStagingPath(sessionId);

    await fs.mkdir(stagingContent, { recursive: true });
    await fs.mkdir(stagingAssets, { recursive: true });

    this.logger?.info('Promoting staged content', {
      sessionId,
      stagingContent,
      stagingAssets,
    });

    await this.clearRootExcept(this.contentRoot, ['.staging']);
    await this.clearRootExcept(this.assetsRoot, ['.staging']);

    await this.copyDirContents(stagingContent, this.contentRoot);
    await this.copyDirContents(stagingAssets, this.assetsRoot);

    await this.cleanupStaging(sessionId);

    this.logger?.info('Staging promoted to production roots', { sessionId });
  }

  async discardSession(sessionId: string): Promise<void> {
    const contentStage = this.contentStagingPath(sessionId);
    const assetsStage = this.assetsStagingPath(sessionId);
    await fs.rm(contentStage, { recursive: true, force: true });
    await fs.rm(assetsStage, { recursive: true, force: true });
    this.logger?.info('Discarded staging session', { sessionId });
  }

  /**
   * Supprime totalement le contenu et les assets (y compris le staging).
   * Le rÇ¸pertoire racine reste prÇ¸sent mais vidÇ¸.
   */
  async purgeAll(): Promise<void> {
    this.logger?.warn('Purging all content and assets from VPS');
    await this.clearRootExcept(this.contentRoot, []);
    await this.clearRootExcept(this.assetsRoot, []);
    this.logger?.info('Content and assets purged');
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
}
