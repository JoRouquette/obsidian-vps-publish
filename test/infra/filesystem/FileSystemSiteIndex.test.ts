import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { FileSystemSiteIndex } from '../../../src/infra/filesystem/FileSystemSiteIndex';
import type { Manifest } from '../../../src/application/ports/SiteIndexPort';

async function createTempDir(): Promise<string> {
  const base = os.tmpdir();
  return fs.mkdtemp(path.join(base, 'site-index-test-'));
}

describe('FileSystemSiteIndex (manifest + rebuild)', () => {
  it('écrit le manifest, génère index.html racine (dossiers uniquement) et index.html de dossier', async () => {
    const dir = await createTempDir();
    const index = new FileSystemSiteIndex(dir);

    const manifest: Manifest = {
      pages: [
        {
          route: '/blog/my-note',
          slug: 'my-note',
          title: 'Ma note',
          description: 'Une description',
          tags: ['test'],
          publishedAt: new Date('2025-01-01T12:00:00.000Z'),
          updatedAt: new Date('2025-01-01T12:30:00.000Z'),
        },
      ],
    };

    await index.saveManifest(manifest);
    await index.rebuildAllIndexes(manifest);

    // Vérifie le manifest
    const manifestPath = path.join(dir, '_manifest.json');
    const manifestRaw = await fs.readFile(manifestPath, 'utf8');
    const stored = JSON.parse(manifestRaw) as {
      pages: Array<{
        route: string;
        title: string;
        slug: string;
        publishedAt: string;
        updatedAt: string;
      }>;
    };

    expect(Array.isArray(stored.pages)).toBe(true);
    expect(stored.pages).toHaveLength(1);
    expect(stored.pages[0].route).toBe('/blog/my-note');
    expect(stored.pages[0].title).toBe('Ma note');
    expect(typeof stored.pages[0].publishedAt).toBe('string');

    // Vérifie l'index racine : ne liste que les dossiers top-level (ici "blog"), pas les pages
    const rootIndexPath = path.join(dir, 'index.html');
    const rootHtml = await fs.readFile(rootIndexPath, 'utf8');
    expect(rootHtml).toContain('Folders');
    expect(rootHtml).toContain('href="/blog/"'); // dossier
    expect(rootHtml).not.toContain('/blog/my-note'); // aucune page directe à la racine

    // Vérifie l'index du dossier /blog
    const blogIndexPath = path.join(dir, 'blog', 'index.html');
    const blogHtml = await fs.readFile(blogIndexPath, 'utf8');
    expect(blogHtml).toContain('Pages');
    expect(blogHtml).toContain('href="/blog/my-note/"'); // page du dossier
    expect(blogHtml).toContain('Ma note');

    // Nettoyage
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('réécrit intégralement les index de dossiers à chaque sauvegarde du manifest (pas de doublons, remplace les titres)', async () => {
    const dir = await createTempDir();
    const index = new FileSystemSiteIndex(dir);

    // 1) Premier manifest : une page /blog/old (Ancien titre)
    const manifestV1: Manifest = {
      pages: [
        {
          route: '/blog/old',
          slug: 'old',
          title: 'Ancien titre',
          description: 'Ancienne description',
          tags: [],
          publishedAt: new Date('2025-01-01T12:00:00.000Z'),
          updatedAt: new Date('2025-01-01T12:30:00.000Z'),
        },
      ],
    };

    await index.saveManifest(manifestV1);
    await index.rebuildAllIndexes(manifestV1);

    // Sanity: l’index /blog contient "Ancien titre"
    const blogIndexPath = path.join(dir, 'blog', 'index.html');
    let blogHtml = await fs.readFile(blogIndexPath, 'utf8');
    expect(blogHtml).toContain('Ancien titre');
    expect(blogHtml).not.toContain('Autre note');

    // 2) Second manifest : met à jour /blog/old (Nouveau titre) + ajoute /blog/other
    const manifestV2: Manifest = {
      pages: [
        {
          route: '/blog/old',
          slug: 'old',
          title: 'Nouveau titre',
          description: 'Nouvelle description',
          tags: [],
          publishedAt: new Date('2025-01-02T12:00:00.000Z'),
          updatedAt: new Date('2025-01-02T12:30:00.000Z'),
        },
        {
          route: '/blog/other',
          slug: 'other',
          title: 'Autre note',
          description: 'Autre description',
          tags: [],
          publishedAt: new Date('2025-01-03T12:00:00.000Z'),
          updatedAt: new Date('2025-01-03T12:30:00.000Z'),
        },
      ],
    };

    await index.saveManifest(manifestV2); // écrase le manifest précédent
    await index.rebuildAllIndexes(manifestV2); // régénère tous les index de dossiers

    // L’index /blog a été réécrit : plus "Ancien titre", mais "Nouveau titre" et "Autre note"
    blogHtml = await fs.readFile(blogIndexPath, 'utf8');
    expect(blogHtml).toContain('Nouveau titre');
    expect(blogHtml).toContain('Autre note');
    expect(blogHtml).not.toContain('Ancien titre');

    // L’index racine liste le dossier /blog une seule fois (pas de doublon)
    const rootIndexPath = path.join(dir, 'index.html');
    const rootHtml = await fs.readFile(rootIndexPath, 'utf8');
    const matches = rootHtml.match(/href="\/blog\/"/g) ?? [];
    expect(matches.length).toBe(1);

    // Nettoyage
    await fs.rm(dir, { recursive: true, force: true });
  });
});
