import { promises as fs } from 'node:fs';
import path from 'node:path';
import { LoggerPort } from '../../application/ports/LoggerPort';
import type { StoragePort } from '../../application/ports/StoragePort';

export class FileSystemContentStorage implements StoragePort {
  constructor(
    private readonly rootDir: string,
    private readonly logger?: LoggerPort
  ) {}

  async save(params: { route: string; content: string; slug?: string }): Promise<void> {
    const normalizedRoute = this.normalizeRoute(params.route);

    const segs = normalizedRoute.replace(/^\/+/, '').split('/').filter(Boolean);

    try {
      if (segs.length === 0) {
        const filePath = path.join(this.rootDir, 'index.html');
        await fs.mkdir(this.rootDir, { recursive: true });
        await fs.writeFile(filePath, params.content, 'utf8');
        this.logger?.info('Saved HTML to root index.html', { filePath, route: params.route });
        return;
      }

      const fileSlug = params.slug ?? 'index';
      const fileSegments = [...segs.slice(0, -1), `${fileSlug}.html`];
      const filePath = path.join(this.rootDir, ...fileSegments);

      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, params.content, 'utf8');
      this.logger?.info('Saved HTML to file', { filePath, route: params.route, slug: params.slug });
    } catch (error) {
      this.logger?.error('Failed to save HTML file', {
        error,
        route: params.route,
        slug: params.slug,
      });
      throw error;
    }
  }

  private normalizeRoute(route: string): string {
    let r = route.trim();
    if (!r.startsWith('/')) r = '/' + r;
    if (r.length > 1) r = r.replace(/\/+$/, '');
    return r;
  }
}
