import { AbstractInputSuggest, App, TFile } from 'obsidian';

type FrontmatterPropertySuggestion = { key: string; count: number };

/**
 * Suggester de propriétés de frontmatter présentes dans le vault.
 */
export class FrontmatterPropertySuggester extends AbstractInputSuggest<FrontmatterPropertySuggestion> {
  constructor(app: App, private readonly inputEl: HTMLInputElement) {
    super(app, inputEl);
  }

  getSuggestions(query: string): FrontmatterPropertySuggestion[] {
    const normalizedQuery = (query || '').toLowerCase();
    const counts = new Map<string, number>();

    const files: TFile[] = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter;
      if (!fm || typeof fm !== 'object') continue;

      for (const key of Object.keys(fm)) {
        // Clés internes d'Obsidian à ignorer
        if (key === 'position' || key === 'tags') continue;
        const k = key.trim();
        if (!k) continue;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .map(([key, count]) => ({ key, count }))
      .filter((s) => !normalizedQuery || s.key.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.key.localeCompare(b.key);
      });
  }

  renderSuggestion(suggestion: FrontmatterPropertySuggestion, el: HTMLElement): void {
    el.createSpan({ text: suggestion.key });
    const count = el.createSpan({ text: ` (${suggestion.count})` });
    count.addClass('ptpv-suggest-count');
  }

  selectSuggestion(suggestion: FrontmatterPropertySuggestion): void {
    this.inputEl.value = suggestion.key;
    // Déclenche l'event "input" pour que le Setting capte la modification.
    this.inputEl.dispatchEvent(new Event('input'));
    this.close();
  }
}
