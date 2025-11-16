import { describe, it, expect } from 'vitest';
import { PublishNotesUseCase } from '../src/application/usecases/PublishNotesUseCase';
import type { MarkdownRendererPort } from '../src/application/ports/MarkdownRendererPort';
import type { StoragePort } from '../src/application/ports/StoragePort';
import type { SiteIndexPort, Manifest } from '../src/application/ports/SiteIndexPort';
import type { Note } from '../src/domain/entities/Note';

class FakeMarkdownRenderer implements MarkdownRendererPort {
  async render(markdown: string): Promise<string> {
    return `<p>${markdown}</p>`;
  }
}

class FakeContentStorage implements StoragePort {
  public saves: { route: string; html: string }[] = [];
  public failOnRoute?: string;

  async save(params: { route: string; html: string }): Promise<void> {
    if (this.failOnRoute && params.route === this.failOnRoute) {
      throw new Error('Simulated FS error');
    }
    this.saves.push(params);
  }
}

class FakeSiteIndex implements SiteIndexPort {
  public savedManifests: Manifest[] = [];
  public rebuildCalls: Manifest[] = [];

  async saveManifest(manifest: Manifest): Promise<void> {
    this.savedManifests.push(manifest);
  }

  async rebuildAllIndexes(manifest: Manifest): Promise<void> {
    this.rebuildCalls.push(manifest);
  }
}

function makeNote(overrides?: Partial<Note>): Note {
  return {
    id: '1',
    slug: 'my-note',
    vaultPath: 'vault/blog/my-note.md',
    relativePath: 'blog/my-note',
    route: '/blog/my-note',
    markdown: '# Titre\n\nContenu',
    frontmatter: {
      title: 'Titre de test',
      description: 'Description de test',
      date: '2025-01-01T00:00:00.000Z',
      tags: ['test'],
    },
    publishedAt: new Date('2025-01-01T12:00:00.000Z'),
    updatedAt: new Date('2025-01-01T12:30:00.000Z'),
    ...overrides,
  };
}

describe('PublishNotesUseCase', () => {
  it('publie une note, persiste la page et reconstruit les index (manifest complet)', async () => {
    const markdownRenderer = new FakeMarkdownRenderer();
    const contentStorage = new FakeContentStorage();
    const siteIndex = new FakeSiteIndex();

    const useCase = new PublishNotesUseCase(markdownRenderer, contentStorage, siteIndex);

    const note = makeNote();
    const result = await useCase.execute({ notes: [note] });

    expect(result.published).toBe(1);
    expect(result.errors).toHaveLength(0);

    // Page
    expect(contentStorage.saves).toHaveLength(1);
    expect(contentStorage.saves[0].route).toBe('/blog/my-note');
    expect(contentStorage.saves[0].html).toContain('Scribe Ektaron');
    expect(contentStorage.saves[0].html).toContain('Titre de test');

    // Manifest + rebuild
    expect(siteIndex.savedManifests).toHaveLength(1);
    const manifest = siteIndex.savedManifests[0];
    expect(manifest.pages).toHaveLength(1);
    expect(manifest.pages[0].route).toBe('/blog/my-note');
    expect(manifest.pages[0].title).toBe('Titre de test');
    expect(manifest.pages[0].slug).toBe('my-note');
    expect(manifest.pages[0].publishedAt instanceof Date).toBe(true);
    expect(manifest.pages[0].updatedAt instanceof Date).toBe(true);

    expect(siteIndex.rebuildCalls).toHaveLength(1);
    expect(siteIndex.rebuildCalls[0]).toBe(manifest);
  });

  it('gère une erreur sur une note sans planter les autres et reconstruit les index sans la note échouée', async () => {
    const markdownRenderer = new FakeMarkdownRenderer();
    const contentStorage = new FakeContentStorage();
    const siteIndex = new FakeSiteIndex();

    const useCase = new PublishNotesUseCase(markdownRenderer, contentStorage, siteIndex);

    const okNote = makeNote({
      id: 'ok',
      route: '/blog/ok',
      slug: 'ok',
      frontmatter: { title: 'OK', description: '...', tags: [] } as any,
    });
    const badNote = makeNote({
      id: 'bad',
      route: '/blog/fail',
      slug: 'fail',
      frontmatter: { title: 'FAIL', description: '...', tags: [] } as any,
    });

    contentStorage.failOnRoute = '/blog/fail';

    const result = await useCase.execute({ notes: [okNote, badNote] });

    expect(result.published).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].noteId).toBe('bad');

    // Page OK seulement
    expect(contentStorage.saves).toHaveLength(1);
    expect(contentStorage.saves[0].route).toBe('/blog/ok');

    // Manifest/Index : uniquement la note OK
    expect(siteIndex.savedManifests).toHaveLength(1);
    expect(siteIndex.rebuildCalls).toHaveLength(1);

    const manifest = siteIndex.savedManifests[0];
    expect(manifest.pages).toHaveLength(1);
    expect(manifest.pages[0].route).toBe('/blog/ok');
    expect(manifest.pages[0].title).toBe('OK');
    expect(siteIndex.rebuildCalls[0]).toBe(manifest);
  });
});
