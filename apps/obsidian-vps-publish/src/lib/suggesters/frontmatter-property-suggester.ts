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
    const normalized = (query || '').toLowerCase();
    const cacheAny = this.app.metadataCache as any;
    const fileCacheGetter =
      typeof cacheAny.getFileCache === 'function' ? cacheAny.getFileCache.bind(cacheAny) : null;
    const cachedFiles: string[] =
      (typeof cacheAny.getCachedFiles === 'function' ? cacheAny.getCachedFiles() : []) || [];

    const counts = new Map<string, number>();

    for (const path of cachedFiles) {
      const fileCache = fileCacheGetter ? fileCacheGetter(path) : null;
      const fm = fileCache?.frontmatter;
      if (!fm || typeof fm !== 'object') continue;

      for (const key of Object.keys(fm)) {
        // Clés internes d'Obsidian à ignorer
        if (key === 'position' || key === 'tags') continue;
        const current = counts.get(key) ?? 0;
        counts.set(key, current + 1);
      }
    }

    return Array.from(counts.entries())
      .map(([key, count]) => ({ key, count }))
      .filter((s) => !normalized || s.key.toLowerCase().includes(normalized))
      .sort((a, b) => b.count - a.count);
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
