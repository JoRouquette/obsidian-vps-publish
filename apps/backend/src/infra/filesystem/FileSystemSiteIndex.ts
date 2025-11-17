import { promises as fs } from 'fs';
import * as path from 'path';
import { Manifest, ManifestPage, SiteIndexPort } from '../../application/ports/SiteIndexPort';
import { renderFolderIndex, renderRootIndex } from './SiteIndexTemplates';
import { LoggerPort } from '../../application/ports/LoggerPort';

export class FileSystemSiteIndex implements SiteIndexPort {
  constructor(
    private readonly contentRoot: string,
    private readonly logger?: LoggerPort
  ) {}

  private manifestPath() {
    return path.join(this.contentRoot, '_manifest.json');
  }

  async saveManifest(manifest: Manifest): Promise<void> {
    try {
      await fs.mkdir(this.contentRoot, { recursive: true });
      await fs.writeFile(this.manifestPath(), JSON.stringify(manifest, null, 2), 'utf8');
      this.logger?.info('Manifest saved', { path: this.manifestPath() });
    } catch (error) {
      this.logger?.error('Failed to save manifest', { error });
      throw error;
    }
  }

  async rebuildAllIndexes(manifest: Manifest): Promise<void> {
    this.logger?.info('Rebuilding all indexes', { contentRoot: this.contentRoot });
    const folders = this.buildFolderMap(manifest);

    const topDirs = [...folders.keys()]
      .filter((f) => f !== '/')
      .filter((f) => f.split('/').filter(Boolean).length === 1)
      .map((dir) => {
        const node = folders.get(dir)!;
        const count = (node.pages.length || 0) + (node.subfolders.size || 0);
        return { name: dir.replace('/', ''), href: dir, count }; // href sans slash final
      });

    await this.writeHtml(path.join(this.contentRoot, 'index.html'), renderRootIndex(topDirs));
    this.logger?.debug('Root index.html written', {
      path: path.join(this.contentRoot, 'index.html'),
    });

    for (const [folder, data] of folders.entries()) {
      if (folder === '/') continue;

      const folderDir = path.join(this.contentRoot, ...folder.split('/').filter(Boolean));
      await fs.mkdir(folderDir, { recursive: true });

      const subfolders = [...data.subfolders].map((sf) => {
        const sfPath = folder === '/' ? `/${sf}` : `${folder}/${sf}`;
        const node = folders.get(sfPath);
        const count = (node?.pages.length || 0) + (node?.subfolders.size || 0);
        return { name: sf, href: sfPath, count }; // href sans slash final
      });

      await this.writeHtml(
        path.join(folderDir, 'index.html'),
        renderFolderIndex(folder, data.pages, subfolders)
      );
      this.logger?.debug('Folder index.html written', {
        folder,
        path: path.join(folderDir, 'index.html'),
      });
    }
    this.logger?.info('All indexes rebuilt');
  }

  private buildFolderMap(
    manifest: Manifest
  ): Map<string, { pages: ManifestPage[]; subfolders: Set<string> }> {
    type Node = { pages: ManifestPage[]; subfolders: Set<string> };
    const map = new Map<string, Node>();
    const ensure = (folder: string) => {
      if (!map.has(folder)) map.set(folder, { pages: [], subfolders: new Set() });
      return map.get(folder)!;
    };

    ensure('/');

    for (const p of manifest.pages) {
      let route = p.route.trim();
      if (!route.startsWith('/')) route = '/' + route;
      if (route.length > 1) route = route.replace(/\/+$/, '');

      const segs = route.split('/').filter(Boolean);
      if (segs.length === 0) {
        ensure('/').pages.push(p);
        continue;
      }

      for (let i = 0; i < segs.length - 1; i++) {
        const parentPath = i === 0 ? '/' : '/' + segs.slice(0, i).join('/');
        const childName = segs[i];
        ensure(parentPath).subfolders.add(childName);
        const childPath = '/' + segs.slice(0, i + 1).join('/');
        ensure(childPath);
      }

      const parentFolder = segs.length === 1 ? '/' : '/' + segs.slice(0, -1).join('/');
      ensure(parentFolder).pages.push(p);
    }

    this.logger?.debug('Folder map built', { folderCount: map.size });
    return map;
  }

  private async writeHtml(filePath: string, html: string) {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, html, 'utf8');
      this.logger?.debug('HTML file written', { filePath });
    } catch (error) {
      this.logger?.error('Failed to write HTML file', { filePath, error });
      throw error;
    }
  }
}
