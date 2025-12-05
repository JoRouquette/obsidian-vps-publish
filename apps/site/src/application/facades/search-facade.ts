import { computed, Inject, Injectable, signal } from '@angular/core';
import type { ContentSearchIndex, ContentSearchIndexEntry } from '@core-domain';

import type { SearchIndexRepository } from '../../domain/ports/search-index-repository.port';
import { SEARCH_INDEX_REPOSITORY } from '../../domain/ports/tokens';

export interface SearchResult {
  route: string;
  title: string;
  matches: Array<{ sentence: string; parts: Array<{ text: string; matched: boolean }> }>;
}

@Injectable({ providedIn: 'root' })
export class SearchFacade {
  private inFlight: Promise<void> | null = null;
  index = signal<ContentSearchIndex | null>(null);
  query = signal('');
  loading = signal(false);
  error = signal<string | null>(null);

  hasQuery = computed(() => this.query().trim().length > 0);
  queryTooShort = computed(() => {
    const q = this.query().trim();
    return q.length > 0 && q.length < 3;
  });

  results = computed<SearchResult[]>(() => {
    const idx = this.index();
    const q = this.query().trim();
    if (!idx || q.length < 3) return [];

    const lower = q.toLowerCase();
    return idx.entries
      .map((entry) => this.buildResult(entry, q, lower))
      .filter((r): r is SearchResult => Boolean(r));
  });

  constructor(
    @Inject(SEARCH_INDEX_REPOSITORY) private readonly repository: SearchIndexRepository
  ) {}

  setQuery(q: string) {
    this.query.set(q ?? '');
  }

  async ensureIndex(): Promise<void> {
    if (this.index()) return;
    if (this.inFlight) return this.inFlight;

    this.loading.set(true);
    this.error.set(null);
    this.inFlight = this.repository
      .load()
      .then((idx) => this.index.set(idx))
      .catch((err) => {
        const fallback = 'Index de recherche indisponible pour le moment.';
        const msg = err instanceof Error ? err.message : fallback;
        this.error.set(msg || fallback);
      })
      .finally(() => {
        this.loading.set(false);
        this.inFlight = null;
      });

    return this.inFlight;
  }

  private buildResult(
    entry: ContentSearchIndexEntry,
    queryRaw: string,
    queryLower: string
  ): SearchResult | null {
    const sentences = Array.isArray(entry.sentences) ? entry.sentences : [];
    const qNorm = this.normalize(queryRaw);
    const matches = sentences
      .filter((s) => this.normalize(s).includes(qNorm) || s.toLowerCase().includes(queryLower))
      .slice(0, 6) // limit to a few sentences per file
      .map((sentence) => ({
        sentence,
        parts: this.highlightParts(sentence, queryRaw),
      }));

    if (matches.length === 0) return null;

    return {
      route: entry.route,
      title: entry.title || entry.route,
      matches,
    };
  }

  private highlightParts(
    sentence: string,
    query: string
  ): Array<{ text: string; matched: boolean }> {
    if (!query) return [{ text: sentence, matched: false }];

    const normSentence = this.normalize(sentence);
    const normQuery = this.normalize(query);
    if (!normQuery) return [{ text: sentence, matched: false }];

    const regex = new RegExp(this.escapeRegExp(normQuery), 'gi');
    const parts: Array<{ text: string; matched: boolean }> = [];
    let lastIndex = 0;

    const matches = normSentence.matchAll(regex);
    for (const m of matches) {
      const start = m.index ?? 0;
      const len = m[0]?.length ?? 0;
      if (start > lastIndex) {
        parts.push({ text: sentence.slice(lastIndex, start), matched: false });
      }
      parts.push({ text: sentence.slice(start, start + len), matched: true });
      lastIndex = start + len;
    }

    if (lastIndex < sentence.length) {
      parts.push({ text: sentence.slice(lastIndex), matched: false });
    }

    const filtered = parts.filter((p) => p.text.length > 0);
    if (filtered.length === 0) {
      return [{ text: sentence, matched: false }];
    }
    return filtered;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
}
