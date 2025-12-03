import { BaseService } from '../../common/base-service';
import { LoggerPort } from '@core-domain';
import { PublishableNote } from '@core-domain/entities/publishable-note';
import { SanitizationRules } from '@core-domain/entities/sanitization-rules';
import { normalizePropertyKey } from '@core-domain/utils/string.utils';

export class ContentSanitizerService implements BaseService {
  constructor(
    private readonly sanitizationRules: SanitizationRules[] = [],
    private readonly frontmatterKeysToExclude?: string[],
    private readonly frontmatterTagsToExclude?: string[],
    private readonly logger?: LoggerPort
  ) {}

  process(notes: PublishableNote[]): PublishableNote[] {
    if (this.frontmatterKeysToExclude) {
      notes = this.sanitizeFrontmatter(notes);
    }

    if (this.frontmatterTagsToExclude?.length) {
      notes = this.sanitizeTags(notes);
    }

    notes = notes.map((n) => ({ ...n, content: this.stripFrontmatter(n.content) }));

    notes = this.sanitizeContent(notes);

    return notes;
  }

  private sanitizeFrontmatter(notes: PublishableNote[]): PublishableNote[] {
    this.logger?.debug('Sanitizing frontmatter for notes', { notesLength: notes.length });

    const keysToRemove = new Set(
      (this.frontmatterKeysToExclude || []).map((k) => normalizePropertyKey(k)).filter(Boolean)
    );

    if (keysToRemove.size === 0) return notes;

    for (const note of notes) {
      this.logger?.debug('Sanitizing frontmatter for note', { noteId: note.noteId });
      for (const key of Object.keys(note.frontmatter.flat)) {
        if (keysToRemove.has(normalizePropertyKey(key))) {
          this.logger?.debug('Excluding frontmatter key (flat)', { key, noteId: note.noteId });
          delete note.frontmatter.flat[key];
        }
      }

      this.removeNestedKeys(note.frontmatter.nested, keysToRemove, note.noteId);

      for (const rawKey of this.frontmatterKeysToExclude || []) {
        this.deleteNestedPath(note.frontmatter.nested, rawKey);
      }
    }

    return notes;
  }

  private sanitizeTags(notes: PublishableNote[]): PublishableNote[] {
    const exclude = (this.frontmatterTagsToExclude || []).map((t) => t.toLowerCase());
    if (exclude.length === 0) return notes;

    for (const note of notes) {
      const tags = note.frontmatter.tags || [];
      if (!Array.isArray(tags) || tags.length === 0) continue;
      const filtered = tags.filter(
        (tag) => typeof tag !== 'string' || !exclude.includes(tag.toLowerCase())
      );
      if (filtered.length !== tags.length) {
        this.logger?.debug('Excluding frontmatter tags', {
          noteId: note.noteId,
          removed: tags.filter(
            (tag) => typeof tag === 'string' && exclude.includes(tag.toLowerCase())
          ),
        });
        note.frontmatter.tags = filtered;
        note.frontmatter.flat['tags'] = filtered;
        note.frontmatter.nested['tags'] = filtered;
      }
    }

    return notes;
  }

  private sanitizeContent(notes: PublishableNote[]): PublishableNote[] {
    return notes.map((note) => {
      const rulesSource = Array.isArray(note.folderConfig?.sanitization)
        ? note.folderConfig.sanitization
        : this.sanitizationRules;

      const compiled = this.compileRules(rulesSource);
      if (compiled.length === 0) {
        return note;
      }

      let content = note.content;
      for (const rule of compiled) {
        content = content.replace(rule.regex, rule.replacement ?? '');
        this.logger?.debug('Applied sanitization rule', {
          noteId: note.noteId,
          rule: rule.name,
        });
      }

      return { ...note, content };
    });
  }

  private compileRules(
    rules: SanitizationRules[]
  ): Array<SanitizationRules & { regex: RegExp }> {
    const compiled: Array<SanitizationRules & { regex: RegExp }> = [];

    for (const rule of rules || []) {
      if (rule.isEnabled === false) continue;
      try {
        const regex =
          rule.regex instanceof RegExp ? rule.regex : new RegExp(rule.regex, 'g');
        compiled.push({ ...rule, regex });
      } catch (error) {
        this.logger?.warn('Failed to compile sanitization rule', {
          rule,
          error,
        });
      }
    }

    return compiled;
  }

  private removeNestedKeys(
    target: Record<string, unknown>,
    keysToRemove: Set<string>,
    noteId: string
  ): void {
    for (const key of Object.keys(target)) {
      const normalized = normalizePropertyKey(key);
      const value = target[key];

      if (keysToRemove.has(normalized)) {
        this.logger?.debug('Excluding frontmatter key (nested)', { key, noteId });
        delete target[key];
        continue;
      }

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        this.removeNestedKeys(value as Record<string, unknown>, keysToRemove, noteId);
        if (Object.keys(value as Record<string, unknown>).length === 0) {
          delete target[key];
        }
      }
    }
  }

  private deleteNestedPath(target: Record<string, unknown>, rawPath: string): void {
    const segments = rawPath
      .split('.')
      .map((s) => normalizePropertyKey(s))
      .filter(Boolean);
    if (segments.length === 0) return;
    this.deletePathRecursive(target, segments);
  }

  private deletePathRecursive(target: Record<string, unknown>, segments: string[]): void {
    if (segments.length === 0) return;
    const [head, ...rest] = segments;

    for (const key of Object.keys(target)) {
      if (normalizePropertyKey(key) !== head) continue;

      if (rest.length === 0) {
        delete target[key];
        return;
      }

      const next = target[key];
      if (next && typeof next === 'object' && !Array.isArray(next)) {
        this.deletePathRecursive(next as Record<string, unknown>, rest);
        if (Object.keys(next as Record<string, unknown>).length === 0) {
          delete target[key];
        }
      }
    }
  }

  private stripFrontmatter(content: string): string {
    const fmRegex = /^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/;
    if (fmRegex.test(content)) {
      return content.replace(fmRegex, '');
    }
    return content;
  }
}
