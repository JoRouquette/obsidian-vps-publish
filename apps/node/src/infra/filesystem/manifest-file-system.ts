import { type ManifestPort } from '@core-application';
import { type LoggerPort, type Manifest, type ManifestPage } from '@core-domain';
import { promises as fs } from 'fs';
import * as path from 'path';

import { renderFolderIndex, renderRootIndex } from './site-index-templates';

export class ManifestFileSystem implements ManifestPort {
  constructor(
    private readonly contentRoot: string,
    private readonly _logger?: LoggerPort
  ) {}

  private manifestPath() {
    return path.join(this.contentRoot, '_manifest.json');
  }

  async load(): Promise<Manifest | null> {
    try {
      const raw = await fs.readFile(this.manifestPath(), 'utf8');
      const parsed = JSON.parse(raw) as {
        pages?: unknown;
        sessionId?: string;
        createdAt?: string;
        lastUpdatedAt?: string;
        folderDisplayNames?: Record<string, string>;
      };

      const pages: ManifestPage[] = Array.isArray(parsed.pages)
        ? parsed.pages.map((p) => {
            const page = p as ManifestPage & { publishedAt?: string | Date };
            return {
              ...page,
              publishedAt: new Date(page.publishedAt ?? 0),
            };
          })
        : [];

      const manifest: Manifest = {
        sessionId: parsed.sessionId ?? '',
        createdAt: new Date(parsed.createdAt ?? 0),
        lastUpdatedAt: new Date(parsed.lastUpdatedAt ?? 0),
        pages,
        folderDisplayNames: parsed.folderDisplayNames || undefined,
      };

      this._logger?.debug('Manifest loaded', {
        path: this.manifestPath(),
        pages: manifest.pages.length,
        folderDisplayNames: manifest.folderDisplayNames,
      });

      return manifest;
    } catch (error: unknown) {
      const code = (error as { code?: string } | undefined)?.code;
      if (code === 'ENOENT') {
        this._logger?.debug('No existing manifest found', { path: this.manifestPath() });
        return null;
      }

      this._logger?.error('Failed to load manifest', { path: this.manifestPath(), error });
      throw error;
    }
  }

  async save(manifest: Manifest): Promise<void> {
    try {
      await fs.mkdir(this.contentRoot, { recursive: true });

      const serializable = {
        ...manifest,
        createdAt: manifest.createdAt.toISOString(),
        lastUpdatedAt: manifest.lastUpdatedAt.toISOString(),
        pages: manifest.pages.map((p) => {
          const serializedPage = {
            ...p,
            publishedAt: p.publishedAt.toISOString(),
            // Explicitly include blocks to ensure they're serialized
            leafletBlocks: p.leafletBlocks ?? undefined,
          };

          // Debug log for pages with plugin blocks
          if (p.leafletBlocks && p.leafletBlocks.length > 0) {
            this._logger?.debug('Serializing page with Leaflet blocks', {
              title: p.title,
              route: p.route,
              blocksCount: p.leafletBlocks.length,
              blocks: p.leafletBlocks,
            });
          }

          return serializedPage;
        }),
      };

      await fs.writeFile(this.manifestPath(), JSON.stringify(serializable, null, 2), 'utf8');
      this._logger?.debug('Manifest saved', { path: this.manifestPath() });
    } catch (error) {
      this._logger?.error('Failed to save manifest', { error });
      throw error;
    }
  }

  async rebuildIndex(manifest: Manifest, customIndexesHtml?: Map<string, string>): Promise<void> {
    this._logger?.debug('Rebuilding all indexes', {
      contentRoot: this.contentRoot,
      hasCustomContent: customIndexesHtml ? customIndexesHtml.size : 0,
    });
    const folders = this.buildFolderMap(manifest);
    const folderDisplayNames = this.buildFolderDisplayNameMap(manifest);

    const topDirs = [...folders.keys()]
      .filter((f) => f !== '/')
      .filter((f) => f.split('/').filter(Boolean).length === 1)
      .map((dir) => {
        const node = folders.get(dir)!;
        const count = (node.pages.length || 0) + (node.subfolders.size || 0);
        const displayName = folderDisplayNames.get(dir);
        return { name: dir.replace('/', ''), link: dir, count, displayName };
      });

    const rootCustomContent = customIndexesHtml?.get('/');
    await this.writeHtml(
      path.join(this.contentRoot, 'index.html'),
      renderRootIndex(topDirs, rootCustomContent)
    );
    this._logger?.debug('Root index.html written', {
      path: path.join(this.contentRoot, 'index.html'),
      hasCustomContent: !!rootCustomContent,
    });

    for (const [folder, data] of folders.entries()) {
      if (folder === '/') continue;

      const folderDir = path.join(this.contentRoot, ...folder.split('/').filter(Boolean));
      await fs.mkdir(folderDir, { recursive: true });

      const subfolders = [...data.subfolders].map((sf) => {
        const sfPath = folder === '/' ? `/${sf}` : `${folder}/${sf}`;
        const node = folders.get(sfPath);
        const count = (node?.pages.length || 0) + (node?.subfolders.size || 0);
        const displayName = folderDisplayNames.get(sfPath);
        return { name: sf, link: sfPath, count, displayName };
      });

      // Get custom content only for this exact folder (no inheritance)
      const folderCustomContent = customIndexesHtml?.get(folder);

      // Get displayName for current folder
      const currentFolderDisplayName = folderDisplayNames.get(folder);

      await this.writeHtml(
        path.join(folderDir, 'index.html'),
        renderFolderIndex(
          folder,
          data.pages,
          subfolders,
          folderCustomContent,
          currentFolderDisplayName
        )
      );
      this._logger?.debug('Folder index.html written', {
        folder,
        path: path.join(folderDir, 'index.html'),
        hasCustomContent: !!folderCustomContent,
      });
    }
    this._logger?.debug('All indexes rebuilt');
  }

  private buildFolderMap(
    manifest: Manifest
  ): Map<string, { pages: ManifestPage[]; subfolders: Set<string> }> {
    type Node = { pages: ManifestPage[]; subfolders: Set<string> };
    const map = new Map<string, Node>();

    // Always ensure root exists
    map.set('/', { pages: [], subfolders: new Set() });

    for (const p of manifest.pages) {
      const route = p.route;
      const segs = route.split('/').filter(Boolean);

      // Build all parent folders in the path
      let parent = '/';
      for (let i = 0; i < segs.length - 1; i++) {
        const folder = '/' + segs.slice(0, i + 1).join('/');
        if (!map.has(folder)) {
          map.set(folder, { pages: [], subfolders: new Set() });
        }
        // Register subfolder in its parent
        map.get(parent)!.subfolders.add(segs[i]);
        parent = folder;
      }

      // Add page to its parent folder ONLY if it's not a custom index page
      // Custom index pages are used for custom content injection, not listed
      const shouldList = !p.isCustomIndex && p.slug.value !== 'index';

      if (shouldList) {
        const parentFolder = segs.length === 0 ? '/' : '/' + segs.slice(0, -1).join('/');
        if (!map.has(parentFolder)) {
          map.set(parentFolder, { pages: [], subfolders: new Set() });
        }
        map.get(parentFolder)!.pages.push(p);
      }
    }

    this._logger?.debug('Folder map built', { folderCount: map.size });
    return map;
  }

  private buildFolderDisplayNameMap(manifest: Manifest): Map<string, string> {
    const displayNames = new Map<string, string>();

    // Load displayNames from manifest.folderDisplayNames
    if (manifest.folderDisplayNames) {
      for (const [route, displayName] of Object.entries(manifest.folderDisplayNames)) {
        displayNames.set(route, displayName);
      }
    }

    this._logger?.debug('Folder displayName map built', { count: displayNames.size });
    return displayNames;
  }

  private async writeHtml(filePath: string, html: string) {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, html, 'utf8');
      this._logger?.debug('HTML file written', { filePath });
    } catch (error) {
      this._logger?.error('Failed to write HTML file', { filePath, error });
      throw error;
    }
  }
}
