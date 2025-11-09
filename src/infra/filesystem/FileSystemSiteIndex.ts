import { promises as fs } from 'fs';
import * as path from 'path';
import { Manifest, ManifestPage, SiteIndexPort } from '../../application/ports/SiteIndexPort';
import { renderFolderIndex, renderRootIndex } from './SiteIndexTemplates';

export class FileSystemSiteIndex implements SiteIndexPort {
  constructor(private readonly contentRoot: string) {}

  private manifestPath() {
    return path.join(this.contentRoot, '_manifest.json');
  }

  async saveManifest(manifest: Manifest): Promise<void> {
    await fs.mkdir(this.contentRoot, { recursive: true });
    await fs.writeFile(this.manifestPath(), JSON.stringify(manifest, null, 2), 'utf8');
  }

  async rebuildAllIndexes(manifest: Manifest): Promise<void> {
    const folders = this.buildFolderMap(manifest);

    const topDirs = [...folders.keys()]
      .filter((f) => f !== '/')
      .filter((f) => f.split('/').filter(Boolean).length === 1)
      .map((dir) => {
        const count =
          (folders.get(dir)?.pages.length || 0) + (folders.get(dir)?.subfolders.size || 0);
        return { name: dir.replace('/', ''), href: `${dir}/`, count };
      });

    await this.writeHtml(path.join(this.contentRoot, 'index.html'), renderRootIndex(topDirs));

    for (const [folder, data] of folders.entries()) {
      if (folder === '/') continue;
      const folderDir = path.join(this.contentRoot, ...folder.split('/').filter(Boolean));
      await fs.mkdir(folderDir, { recursive: true });

      const subfolders = [...data.subfolders].map((sf) => {
        const sfPath = folder === '/' ? `/${sf}` : `${folder}/${sf}`;
        const count =
          (folders.get(sfPath)?.pages.length || 0) + (folders.get(sfPath)?.subfolders.size || 0);
        return { name: sf, href: `${sfPath}/`, count };
      });

      await this.writeHtml(
        path.join(folderDir, 'index.html'),
        renderFolderIndex(folder, data.pages, subfolders)
      );
    }
  }

  private buildFolderMap(
    manifest: Manifest
  ): Map<string, { pages: ManifestPage[]; subfolders: Set<string> }> {
    const map = new Map<string, { pages: ManifestPage[]; subfolders: Set<string> }>();

    const ensure = (folder: string) => {
      if (!map.has(folder)) map.set(folder, { pages: [], subfolders: new Set() });
      return map.get(folder)!;
    };

    ensure('/');

    for (const p of manifest.pages) {
      const segs = p.route.split('/').filter(Boolean);

      const parent = '/' + segs[0];
      if (segs.length === 2) {
        ensure(parent).pages.push(p);
      }

      if (segs.length !== 2) {
        let acc = '';
        for (let i = 0; i < segs.length - 1; i++) {
          acc = acc ? `${acc}/${segs[i]}` : `/${segs[i]}`;
          ensure(acc);
          if (i > 0) {
            const prev = acc.split('/').filter(Boolean);
            const parentPath = '/' + prev.slice(0, prev.length - 1).join('/');
            ensure(parentPath).subfolders.add(prev[prev.length - 1]);
          } else {
            ensure('/').subfolders.add(segs[0]);
          }
        }

        const pageFolder = '/' + segs.slice(0, segs.length - 1).join('/');
        ensure(pageFolder).pages.push(p);
      } else {
        ensure('/').subfolders.add(segs[0]);
      }
    }

    for (const v of map.values()) {
      v.pages = v.pages.filter(Boolean) as ManifestPage[];
    }

    for (const folder of [...map.keys()]) {
      if (folder === '/') continue;
      const segs = folder.split('/').filter(Boolean);
      if (segs.length >= 2) {
        const parent = '/' + segs.slice(0, segs.length - 1).join('/');
        ensure(parent).subfolders.add(segs[segs.length - 1]);
      }
    }

    return map;
  }

  private async writeHtml(filePath: string, html: string) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, html, 'utf8');
  }
}
