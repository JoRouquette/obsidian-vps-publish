import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  type ContentSearchIndex,
  type ContentSearchIndexEntry,
  type LoggerPort,
  type Manifest,
} from '@core-domain';

export class ContentSearchIndexer {
  constructor(
    private readonly contentRoot: string,
    private readonly logger?: LoggerPort
  ) {}

  async build(manifest: Manifest): Promise<void> {
    const entries: ContentSearchIndexEntry[] = [];

    for (const page of manifest.pages) {
      const filePath = this.resolveHtmlPath(page.route);
      try {
        const html = await fs.readFile(filePath, 'utf8');
        const sentences = this.splitSentences(this.extractText(html));
        const title = page.title ?? String(page.slug ?? page.route);
        entries.push({
          route: page.route,
          title,
          sentences,
        });
      } catch (error) {
        this.logger?.warn?.('Failed to index page content', { route: page.route, filePath, error });
      }
    }

    const index: ContentSearchIndex = {
      sessionId: manifest.sessionId,
      builtAt: new Date().toISOString(),
      entries,
    };

    const target = path.join(this.contentRoot, '_search-index.json');
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, JSON.stringify(index, null, 2), 'utf8');
    this.logger?.info?.('Content search index built', {
      target,
      entries: entries.length,
      sessionId: manifest.sessionId,
    });
  }

  private resolveHtmlPath(route: string): string {
    const normalized = route.replace(/^\/+/, '').replace(/\/+$/, '');
    if (!normalized) return path.join(this.contentRoot, 'index.html');
    const segments = normalized.split('/');
    const file = segments.pop() ?? 'index';
    return path.join(this.contentRoot, ...segments, `${file}.html`);
  }

  private extractText(html: string): string {
    const withoutScripts = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ');
    const withoutTags = withoutScripts.replace(/<[^>]+>/g, ' ');
    const decoded = withoutTags
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
    return decoded.replace(/\s+/g, ' ').trim();
  }

  private splitSentences(text: string): string[] {
    if (!text) return [];
    return text
      .split(/(?<=[.!?])\s+|\n+/g)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
}
