import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { FileSystemSiteIndex } from '../../../src/infra/filesystem/FileSystemSiteIndex';

async function createTempDir(): Promise<string> {
  const base = os.tmpdir();
  return fs.mkdtemp(path.join(base, 'site-index-test-'));
}

describe('FileSystemSiteIndex', () => {
  it('crée un manifest et un index.html pour une nouvelle entrée', async () => {
    const dir = await createTempDir();
    const index = new FileSystemSiteIndex(dir);

    await index.upsertEntries([
      {
        route: '/blog/my-note',
        title: 'Ma note',
        description: 'Une description',
        publishedAt: new Date('2025-01-01T12:00:00.000Z'),
        updatedAt: new Date('2025-01-01T12:30:00.000Z'),
      },
    ]);

    const manifestPath = path.join(dir, '_manifest.json');
    const indexPath = path.join(dir, 'index.html');

    const manifestRaw = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestRaw) as Array<{
      route: string;
      title: string;
    }>;

    expect(manifest).toHaveLength(1);
    expect(manifest[0].route).toBe('/blog/my-note');
    expect(manifest[0].title).toBe('Ma note');

    const html = await fs.readFile(indexPath, 'utf8');
    expect(html).toContain('/blog/my-note');
    expect(html).toContain('Ma note');

    // Nettoyage
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('remplace les entrées existantes sur la même route et garde le tri', async () => {
    const dir = await createTempDir();
    const index = new FileSystemSiteIndex(dir);

    // Première entrée
    await index.upsertEntries([
      {
        route: '/blog/old',
        title: 'Ancien titre',
        description: 'Ancienne description',
        publishedAt: new Date('2025-01-01T12:00:00.000Z'),
        updatedAt: new Date('2025-01-01T12:30:00.000Z'),
      },
    ]);

    // Mise à jour de la même route + ajout d’une deuxième
    await index.upsertEntries([
      {
        route: '/blog/old',
        title: 'Nouveau titre',
        description: 'Nouvelle description',
        publishedAt: new Date('2025-01-02T12:00:00.000Z'),
        updatedAt: new Date('2025-01-02T12:30:00.000Z'),
      },
      {
        route: '/blog/other',
        title: 'Autre note',
        description: 'Autre description',
        publishedAt: new Date('2025-01-03T12:00:00.000Z'),
        updatedAt: new Date('2025-01-03T12:30:00.000Z'),
      },
    ]);

    const manifestPath = path.join(dir, '_manifest.json');
    const manifestRaw = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestRaw) as Array<{
      route: string;
      title: string;
      publishedAt: string;
    }>;

    // On doit avoir 2 entrées : /blog/old et /blog/other
    expect(manifest).toHaveLength(2);

    const oldEntry = manifest.find((e) => e.route === '/blog/old');
    const otherEntry = manifest.find((e) => e.route === '/blog/other');

    expect(oldEntry).toBeDefined();
    expect(oldEntry?.title).toBe('Nouveau titre');

    expect(otherEntry).toBeDefined();

    // Tri décroissant sur publishedAt : other (03) avant old (02)
    expect(manifest[0].route).toBe('/blog/other');

    await fs.rm(dir, { recursive: true, force: true });
  });
});
