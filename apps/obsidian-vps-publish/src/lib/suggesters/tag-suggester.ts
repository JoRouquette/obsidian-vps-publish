import { AbstractInputSuggest, type App } from 'obsidian';

type TagSuggestion = { tag: string; count: number };

/**
 * Suggester de tags du vault (via metadataCache.getTags()).
 */
export class TagSuggester extends AbstractInputSuggest<TagSuggestion> {
  constructor(
    app: App,
    private readonly inputEl: HTMLInputElement
  ) {
    super(app, inputEl);
  }

  getSuggestions(query: string): TagSuggestion[] {
    const normalized = (query || '').toLowerCase();
    const metaCache = this.app.metadataCache as typeof this.app.metadataCache & {
      getTags?: () => Record<string, number>;
    };
    const tags = metaCache.getTags?.() ?? {};

    return Object.entries(tags)
      .map(([tag, count]) => ({
        tag: tag.replace(/^#/, ''),
        count: typeof count === 'number' ? count : 0,
      }))
      .filter((t) => !normalized || t.tag.toLowerCase().includes(normalized))
      .sort((a, b) => b.count - a.count);
  }

  renderSuggestion(suggestion: TagSuggestion, el: HTMLElement): void {
    el.createSpan({ text: `#${suggestion.tag}` });
    const count = el.createSpan({ text: ` (${suggestion.count})` });
    count.addClass('ptpv-suggest-count');
  }

  selectSuggestion(suggestion: TagSuggestion): void {
    this.inputEl.value = suggestion.tag;
    // Déclenche l'event "input" pour que le Setting capte la modification.
    this.inputEl.dispatchEvent(new Event('input'));
    this.close();
  }
}
