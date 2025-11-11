import { promises as fs } from 'fs';
import path from 'path';
import type { ContentStoragePort } from '../../application/ports/ContentStoragePort';

type SavePageParams = { route: string; html: string; slug?: string };

export class FileSystemContentStorage implements ContentStoragePort {
  constructor(private readonly rootDir: string) {}

  async savePage(params: SavePageParams): Promise<void> {
    const normalizedRoute = this.normalizeRoute(params.route);

    const segs = normalizedRoute.replace(/^\/+/, '').split('/').filter(Boolean);

    if (segs.length === 0) {
      const filePath = path.join(this.rootDir, 'index.html');
      await fs.mkdir(this.rootDir, { recursive: true });
      await fs.writeFile(filePath, params.html, 'utf8');
      return;
    }

    const fileSlug = params.slug ? this.slugify(params.slug) : this.slugify(segs[segs.length - 1]);
    const fileSegments = [...segs.slice(0, -1), `${fileSlug}.html`];
    const filePath = path.join(this.rootDir, ...fileSegments);

    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, params.html, 'utf8');
  }

  private normalizeRoute(route: string): string {
    let r = route.trim();
    if (!r.startsWith('/')) r = '/' + r;
    if (r.length > 1) r = r.replace(/\/+$/, '');
    return r;
  }

  private slugify(input: string): string {
    const ascii = input
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^\w\s-]/g, ' ')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase();
    return ascii || 'index';
  }
}
