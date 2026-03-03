import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { type LoggerPort } from '@core-domain';

/**
 * Content version information.
 */
export interface ContentVersion {
  version: string;
  generatedAt: string;
}

/**
 * Listener callback for content version changes.
 */
export type ContentVersionListener = (version: ContentVersion) => void;

/**
 * Service that manages content versioning for cache invalidation.
 *
 * Features:
 * - Computes version from _manifest.json hash
 * - Persists version to _content-version.json
 * - Broadcasts version changes via registered listeners (for SSE)
 */
export class ContentVersionService {
  private currentVersion: ContentVersion | null = null;
  private readonly listeners = new Set<ContentVersionListener>();
  private readonly versionFilePath: string;
  private readonly manifestPath: string;

  constructor(
    private readonly contentRoot: string,
    private readonly logger?: LoggerPort
  ) {
    this.versionFilePath = path.join(contentRoot, '_content-version.json');
    this.manifestPath = path.join(contentRoot, '_manifest.json');
  }

  /**
   * Get current content version.
   * Loads from file if not cached.
   */
  async getVersion(): Promise<ContentVersion | null> {
    if (this.currentVersion) {
      return this.currentVersion;
    }

    try {
      const data = await fs.readFile(this.versionFilePath, 'utf-8');
      this.currentVersion = JSON.parse(data) as ContentVersion;
      return this.currentVersion;
    } catch {
      // File doesn't exist yet, compute from manifest
      return this.computeAndSaveVersion();
    }
  }

  /**
   * Compute version from manifest hash and update.
   * Called after content publication (FinishSession).
   */
  async updateVersion(): Promise<ContentVersion> {
    const newVersion = await this.computeAndSaveVersion();

    if (newVersion) {
      this.notifyListeners(newVersion);
    }

    return newVersion;
  }

  /**
   * Register a listener for version changes (used by SSE).
   * Returns unsubscribe function.
   */
  subscribe(listener: ContentVersionListener): () => void {
    this.listeners.add(listener);

    // Send current version immediately if available
    if (this.currentVersion) {
      listener(this.currentVersion);
    }

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get count of active listeners (for monitoring).
   */
  get listenerCount(): number {
    return this.listeners.size;
  }

  private async computeAndSaveVersion(): Promise<ContentVersion> {
    try {
      // Compute hash from manifest
      const manifestContent = await fs.readFile(this.manifestPath, 'utf-8');
      const hash = createHash('sha256').update(manifestContent).digest('hex').slice(0, 12);

      const version: ContentVersion = {
        version: hash,
        generatedAt: new Date().toISOString(),
      };

      // Save to file
      await fs.writeFile(this.versionFilePath, JSON.stringify(version, null, 2), 'utf-8');

      this.currentVersion = version;

      this.logger?.info('Content version updated', {
        version: version.version,
        generatedAt: version.generatedAt,
      });

      return version;
    } catch (error) {
      this.logger?.error('Failed to compute content version', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Return fallback version based on timestamp
      const fallback: ContentVersion = {
        version: Date.now().toString(36),
        generatedAt: new Date().toISOString(),
      };

      this.currentVersion = fallback;
      return fallback;
    }
  }

  private notifyListeners(version: ContentVersion): void {
    const listenerCount = this.listeners.size;

    if (listenerCount === 0) {
      this.logger?.debug('No listeners for content version update');
      return;
    }

    this.logger?.debug('Broadcasting content version update', {
      version: version.version,
      listenerCount,
    });

    for (const listener of this.listeners) {
      try {
        listener(version);
      } catch (error) {
        this.logger?.error('Error in content version listener', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
