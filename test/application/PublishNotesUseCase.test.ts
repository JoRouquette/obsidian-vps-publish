import { describe, it, expect } from 'vitest';
import { PublishNotesUseCase } from '../../src/application/usecases/PublishNotesUseCase';
import type { MarkdownRendererPort } from '../../src/application/ports/MarkdownRendererPort';
import type { ContentStoragePort } from '../../src/application/ports/ContentStoragePort';
import type { SiteIndexPort, SiteIndexEntry } from '../../src/application/ports/SiteIndexPort';
import type { Note } from '../../src/domain/entities/Note';

class FakeMarkdownRenderer implements MarkdownRendererPort {
  async render(markdown: string): Promise<string> {
    // On simule juste un rendu trivial
    return `<p>${markdown}</p>`;
  }
}

class FakeContentStorage implements ContentStoragePort {
  public saves: { route: string; html: string }[] = [];
  public failOnRoute?: string;

  async savePage(params: { route: string; html: string }): Promise<void> {
    if (this.failOnRoute && params.route === this.failOnRoute) {
      throw new Error('Simulated FS error');
    }
    this.saves.push(params);
  }
}

class FakeSiteIndex implements SiteIndexPort {
  public calls: SiteIndexEntry[][] = [];

  async upsertEntries(entries: SiteIndexEntry[]): Promise<void> {
    this.calls.push(entries);
  }
}

function makeNote(overrides?: Partial<Note>): Note {
  return {
    id: '1',
    slug: 'my-note',
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
  it('publie une note et met à jour l’index', async () => {
    const markdownRenderer = new FakeMarkdownRenderer();
    const contentStorage = new FakeContentStorage();
    const siteIndex = new FakeSiteIndex();

    const useCase = new PublishNotesUseCase(markdownRenderer, contentStorage, siteIndex);

    const note = makeNote();
    const result = await useCase.execute({ notes: [note] });

    expect(result.published).toBe(1);
    expect(result.errors).toHaveLength(0);

    // Vérifie qu’on a bien persisté la page
    expect(contentStorage.saves).toHaveLength(1);
    expect(contentStorage.saves[0].route).toBe('/blog/my-note');
    expect(contentStorage.saves[0].html).toContain('Scribe Ektaron');
    expect(contentStorage.saves[0].html).toContain('Titre de test');

    // Vérifie l’appel à l’index
    expect(siteIndex.calls).toHaveLength(1);
    const entries = siteIndex.calls[0];
    expect(entries).toHaveLength(1);
    expect(entries[0].route).toBe('/blog/my-note');
    expect(entries[0].title).toBe('Titre de test');
  });

  it('gère une erreur sur une note sans planter les autres', async () => {
    const markdownRenderer = new FakeMarkdownRenderer();
    const contentStorage = new FakeContentStorage();
    const siteIndex = new FakeSiteIndex();

    const useCase = new PublishNotesUseCase(markdownRenderer, contentStorage, siteIndex);

    const okNote = makeNote({ id: 'ok', route: '/blog/ok' });
    const badNote = makeNote({ id: 'bad', route: '/blog/fail' });

    contentStorage.failOnRoute = '/blog/fail';

    const result = await useCase.execute({ notes: [okNote, badNote] });

    expect(result.published).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].noteId).toBe('bad');

    // Seule la note OK est persistée
    expect(contentStorage.saves).toHaveLength(1);
    expect(contentStorage.saves[0].route).toBe('/blog/ok');

    // L’index ne doit contenir que la note OK
    expect(siteIndex.calls).toHaveLength(1);
    const entries = siteIndex.calls[0];
    expect(entries).toHaveLength(1);
    expect(entries[0].route).toBe('/blog/ok');
  });
});
