import { promises as fs } from 'node:fs';
import path from 'node:path';

import { LoggerPort } from '../../application/ports/LoggerPort';
import { ContentStoragePort } from '../../application/publishing/ports/ContentStoragePort';
import { resolveWithinRoot } from '../utils/pathUtils';

export class NotesFileSystemStorage implements ContentStoragePort {
  constructor(
    private readonly rootDir: string,
    private readonly logger?: LoggerPort
  ) {}

  async save(params: { route: string; content: string; slug?: string }): Promise<void> {
    const cleanedRoute = path.posix.normalize('/' + (params.route || '').trim());
    const segs = cleanedRoute.replace(/^\/+/, '').split('/').filter(Boolean);

    try {
      let filePath: string;
      if (segs.length === 0) {
        filePath = resolveWithinRoot(this.rootDir, `${params.slug}.html`);
        await fs.mkdir(this.rootDir, { recursive: true });
      } else {
        const fileSlug = params.slug;
        const fileSegments = [...segs.slice(0, -1), `${fileSlug}.html`];
        filePath = resolveWithinRoot(this.rootDir, ...fileSegments);
        const dir = resolveWithinRoot(this.rootDir, ...fileSegments.slice(0, -1));
        await fs.mkdir(dir, { recursive: true });
      }
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
}
