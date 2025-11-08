import { promises as fs } from 'fs';
import path from 'path';
import type { SiteIndexPort, SiteIndexEntry } from '../../application/ports/SiteIndexPort';

interface ManifestEntry {
  route: string;
  title: string;
  description?: string;
  publishedAt: string;
  updatedAt: string;
}

const INDEX_STYLE = `
:root {
  color-scheme: dark;
  --bg: #050608;
  --bg-elevated: #11131a;
  --border: #232635;
  --text: #f7f7fb;
  --muted: #a0a3b8;
  --accent: #e0b05a;
  --accent-soft: rgba(224, 176, 90, 0.08);
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background: radial-gradient(circle at top, #151827 0, #050608 55%);
  color: var(--text);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.container {
  max-width: 820px;
  margin: 0 auto;
  padding: 3rem 1.5rem 4rem;
}

.site-header {
  margin-bottom: 2.5rem;
}

.home-link {
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-decoration: none;
  color: var(--accent);
}

.site-tagline {
  margin: 0.5rem 0 0;
  color: var(--muted);
  font-size: 0.95rem;
}

.page-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 1.25rem;
}

.page-item a {
  display: block;
  text-decoration: none;
  color: inherit;
  background: linear-gradient(135deg, rgba(12, 16, 32, 0.95), rgba(10, 10, 18, 0.95));
  border-radius: 1.25rem;
  border: 1px solid var(--border);
  padding: 1.25rem 1.5rem;
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.45);
  transition: transform 0.12s ease-out, box-shadow 0.12s ease-out,
    border-color 0.12s ease-out, background 0.12s ease-out;
}

.page-item a:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.6);
  border-color: var(--accent);
  background: linear-gradient(135deg, rgba(16, 20, 40, 1), rgba(14, 12, 24, 1));
}

.page-item h2 {
  margin: 0 0 0.4rem;
  font-size: 1.1rem;
}

.page-description {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.page-meta {
  margin: 0.75rem 0 0;
  font-size: 0.8rem;
  color: var(--muted);
}
`;

export class FileSystemSiteIndex implements SiteIndexPort {
  constructor(private readonly rootDir: string) {}

  async upsertEntries(entries: SiteIndexEntry[]): Promise<void> {
    const manifestPath = path.join(this.rootDir, '_manifest.json');
    let existing: ManifestEntry[] = [];

    try {
      const raw = await fs.readFile(manifestPath, 'utf8');
      existing = JSON.parse(raw) as ManifestEntry[];
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        throw err;
      }
    }

    const map = new Map<string, ManifestEntry>();
    for (const e of existing) {
      map.set(e.route, e);
    }

    for (const entry of entries) {
      map.set(entry.route, {
        route: entry.route,
        title: entry.title,
        description: entry.description,
        publishedAt: entry.publishedAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      });
    }

    const manifest = Array.from(map.values()).sort((a, b) =>
      b.publishedAt.localeCompare(a.publishedAt)
    );

    await fs.mkdir(this.rootDir, { recursive: true });
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    const indexHtml = this.buildIndexHtml(manifest);
    await fs.writeFile(path.join(this.rootDir, 'index.html'), indexHtml, 'utf8');
  }

  private buildIndexHtml(manifest: ManifestEntry[]): string {
    const items = manifest
      .map((e) => {
        const title = this.escapeHtml(e.title);
        const description = e.description ? this.escapeHtml(e.description) : '';
        const publishedAt = this.escapeHtml(e.publishedAt.substring(0, 10));

        return `
        <li class="page-item">
          <a href="${e.route}">
            <h2>${title}</h2>
            ${description ? `<p class="page-description">${description}</p>` : ''}
            <p class="page-meta">Publié le ${publishedAt}</p>
          </a>
        </li>`;
      })
      .join('\n');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Scribe Ektaron – Sommaire</title>
  <meta name="description" content="Sommaire des pages publiées">
  <style>
${INDEX_STYLE}
  </style>
</head>
<body>
  <main class="container">
    <header class="site-header">
      <a href="/" class="home-link">Scribe Ektaron</a>
      <p class="site-tagline">Sommaire de ton espace publié.</p>
    </header>
    <section>
      <ul class="page-list">
        ${items}
      </ul>
    </section>
  </main>
</body>
</html>`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
