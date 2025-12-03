import MarkdownIt, { type Token } from 'markdown-it';

export type CalloutFold = 'open' | 'closed';

export interface CalloutMeta {
  type: string;
  label: string;
  icon: string;
  title: string;
  isFoldable: boolean;
  fold: CalloutFold | null;
  inlineBodyHtml?: string;
}

export interface CalloutDefinition {
  type: string;
  label: string;
  icon: string;
  aliases?: string[];
}

export interface CalloutStylePayload {
  path: string;
  css: string;
}

const BASE_DEFINITIONS: CalloutDefinition[] = [
  { type: 'note', label: 'Note', icon: 'sticky_note_2' },
  { type: 'abstract', label: 'Abstract', icon: 'description', aliases: ['summary', 'tldr'] },
  { type: 'info', label: 'Info', icon: 'info' },
  { type: 'todo', label: 'Todo', icon: 'task_alt' },
  { type: 'tip', label: 'Tip', icon: 'lightbulb' },
  { type: 'success', label: 'Success', icon: 'check_circle', aliases: ['check', 'done'] },
  { type: 'question', label: 'Question', icon: 'help', aliases: ['help', 'faq'] },
  { type: 'warning', label: 'Warning', icon: 'warning', aliases: ['caution', 'attention'] },
  { type: 'failure', label: 'Failure', icon: 'error', aliases: ['fail', 'missing'] },
  { type: 'danger', label: 'Danger', icon: 'report', aliases: ['error'] },
  { type: 'bug', label: 'Bug', icon: 'bug_report' },
  { type: 'example', label: 'Example', icon: 'auto_awesome' },
  { type: 'quote', label: 'Quote', icon: 'format_quote', aliases: ['cite'] },
];

export class CalloutRendererService {
  private definitions: CalloutDefinition[] = [...BASE_DEFINITIONS];
  private lookup: Record<string, CalloutDefinition> = this.buildLookup(this.definitions);
  private userCss = '';

  getUserCss(): string {
    return this.userCss;
  }

  extendDefinitions(defs: CalloutDefinition[]): void {
    for (const def of defs) {
      const type = this.sanitizeCalloutType(def.type);
      const existing = this.lookup[type];
      if (existing) {
        existing.icon = def.icon || existing.icon;
        existing.label = def.label || existing.label;
        existing.aliases = Array.from(
          new Set(
            [...(existing.aliases ?? []), ...(def.aliases ?? [])].map(this.sanitizeCalloutType)
          )
        );
      } else {
        const normalized: CalloutDefinition = {
          type,
          label: def.label || this.capitalize(type),
          icon: def.icon || type.charAt(0).toUpperCase(),
          aliases: (def.aliases ?? []).map(this.sanitizeCalloutType),
        };
        this.definitions.push(normalized);
      }
    }
    this.lookup = this.buildLookup(this.definitions);
  }

  extendFromStyles(styles: CalloutStylePayload[]): CalloutDefinition[] {
    const defs = styles.flatMap((s) => this.extractDefinitionsFromCss(s.css));
    if (defs.length > 0) {
      this.extendDefinitions(defs);
    }
    this.userCss = styles.length > 0 ? styles.map((s) => s.css).join('\n\n') : '';
    return defs;
  }

  register(md: MarkdownIt): void {
    const defaultOpen =
      md.renderer.rules.blockquote_open ??
      ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
    const defaultClose =
      md.renderer.rules.blockquote_close ??
      ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

    md.core.ruler.after('block', 'obsidian-callouts', (state) => {
      const tokens = state.tokens;

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.type !== 'blockquote_open') continue;

        const closeIdx = this.findBlockquoteClose(tokens, i, token.level);
        if (closeIdx === -1) continue;

        const header = this.findCalloutHeader(tokens, i + 1, closeIdx, token.level);
        if (!header) continue;

        const meta = this.parseCalloutMeta(header.firstLine, header.definition);
        if (!meta) continue;

        const inlineBody = this.normalizeCalloutBody(header.body);
        const parsedBody =
          inlineBody.trim().length > 0 ? state.md.parseInline(inlineBody, state.env) : [];
        const inlineBodyHtml =
          parsedBody.length > 0
            ? `<p>${state.md.renderer.renderInline(
                parsedBody[0]?.children ?? [],
                state.md.options,
                state.env
              )}</p>`
            : '';

        tokens[header.paragraphOpen].hidden = true;
        tokens[header.inlineIndex].hidden = true;
        tokens[header.paragraphClose].hidden = true;
        header.inline.content = '';
        header.inline.children = [];

        const calloutMeta = { ...meta, inlineBodyHtml };
        tokens[i].meta = { ...(tokens[i].meta ?? {}), callout: calloutMeta };
        tokens[closeIdx].meta = { ...(tokens[closeIdx].meta ?? {}), callout: calloutMeta };
      }
    });

    md.renderer.rules.blockquote_open = (tokens, idx, options, env, self) => {
      const callout: CalloutMeta | undefined = tokens[idx].meta?.callout;
      if (!callout) {
        return defaultOpen(tokens, idx, options, env, self);
      }

      const title = callout.title || callout.label;
      const titleHtml = md.renderInline(title, env);
      const typeAttr = ` data-callout="${callout.type}"`;
      const iconName = this.normalizeIconName(callout.icon);
      const bodyHtml = callout.inlineBodyHtml ?? '';

      if (callout.isFoldable) {
        const foldAttr = ` data-callout-fold="${callout.fold}"`;
        const openAttr = callout.fold !== 'closed' ? ' open' : '';
        return `<details class="callout"${typeAttr}${foldAttr}${openAttr}>
<summary class="callout-title">
  <span class="callout-icon material-symbols-outlined" data-icon="${this.escapeHtml(iconName)}" aria-hidden="true">${this.escapeHtml(iconName)}</span>
  <span class="callout-label">${titleHtml}</span>
</summary>
<div class="callout-content">
${bodyHtml}
`;
      }

      return `<div class="callout"${typeAttr}>
  <div class="callout-title">
    <span class="callout-icon material-symbols-outlined" data-icon="${this.escapeHtml(iconName)}" aria-hidden="true">${this.escapeHtml(iconName)}</span>
    <span class="callout-label">${titleHtml}</span>
  </div>
  <div class="callout-content">
${bodyHtml}
`;
    };

    md.renderer.rules.blockquote_close = (tokens, idx, options, env, self) => {
      const callout: CalloutMeta | undefined = tokens[idx].meta?.callout;
      if (!callout) {
        return defaultClose(tokens, idx, options, env, self);
      }

      return callout.isFoldable ? '</div></details>\n' : '  </div>\n</div>\n';
    };
  }

  private findBlockquoteClose(tokens: Token[], openIdx: number, level: number): number {
    for (let i = openIdx + 1; i < tokens.length; i++) {
      if (tokens[i].type === 'blockquote_close' && tokens[i].level === level) {
        return i;
      }
    }
    return -1;
  }

  private findCalloutHeader(
    tokens: Token[],
    start: number,
    end: number,
    blockquoteLevel: number
  ): {
    paragraphOpen: number;
    inlineIndex: number;
    paragraphClose: number;
    inline: Token;
    definition: CalloutDefinition;
    firstLine: string;
    body: string;
  } | null {
    for (let i = start; i < end; i++) {
      const inline = tokens[i];
      if (inline.type !== 'inline' || inline.level !== blockquoteLevel + 2) {
        continue;
      }

      const paraOpenIdx = i - 1;
      if (!tokens[paraOpenIdx] || tokens[paraOpenIdx].type !== 'paragraph_open') {
        return null;
      }

      const paraCloseIdx = this.findNextTokenOfType(tokens, i + 1, end, 'paragraph_close');
      if (paraCloseIdx === -1) return null;

      const { firstLine, body } = this.splitCalloutContent(inline.content);
      const def = this.resolveCalloutDefinition(firstLine);
      if (!def) return null;

      return {
        paragraphOpen: paraOpenIdx,
        inlineIndex: i,
        paragraphClose: paraCloseIdx,
        inline,
        definition: def,
        firstLine,
        body,
      };
    }

    return null;
  }

  private findNextTokenOfType(tokens: Token[], start: number, end: number, type: string): number {
    for (let i = start; i < end; i++) {
      if (tokens[i].type === type) return i;
    }
    return -1;
  }

  private resolveCalloutDefinition(firstLine: string): CalloutDefinition | null {
    const match = firstLine.trimStart().match(/^\[!([^\]\s]+)\]/i);
    if (!match) return null;

    const rawType = this.sanitizeCalloutType(match[1]);
    return (
      this.lookup[rawType] ?? {
        type: rawType,
        label: this.capitalize(rawType),
        icon: rawType.charAt(0).toUpperCase(),
      }
    );
  }

  private parseCalloutMeta(firstLine: string, def: CalloutDefinition): CalloutMeta | null {
    const match = firstLine.trimStart().match(/^\[!([^\]\s]+)\]\s*([+-])?\s*(.*)$/i);
    if (!match) return null;

    const [, rawType, foldSymbol, titlePart] = match;
    const typeInfo = this.lookup[this.sanitizeCalloutType(rawType)] ?? def;
    const isFoldable = foldSymbol === '+' || foldSymbol === '-';
    const fold: CalloutFold | null = isFoldable ? (foldSymbol === '-' ? 'closed' : 'open') : null;
    const title = (titlePart ?? '').trim() || typeInfo.label;

    return {
      type: typeInfo.type,
      label: typeInfo.label,
      icon: typeInfo.icon,
      title,
      isFoldable,
      fold,
    };
  }

  private splitCalloutContent(content: string): { firstLine: string; body: string } {
    const [firstLine = '', ...rest] = content.split(/\r?\n/);
    return { firstLine: firstLine.trimStart(), body: rest.join('\n') };
  }

  private normalizeCalloutBody(body: string): string {
    if (!body) return '';
    return body.startsWith('\n') ? body.slice(1) : body;
  }

  private sanitizeCalloutType = (raw: string): string => {
    const normalized = raw
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/-+/g, '-');
    const trimmed = normalized.replace(/^-+|-+$/g, '');
    return trimmed || 'note';
  };

  private capitalize(input: string): string {
    if (!input) return '';
    return input.charAt(0).toUpperCase() + input.slice(1);
  }

  private buildLookup(defs: CalloutDefinition[]): Record<string, CalloutDefinition> {
    const map: Record<string, CalloutDefinition> = {};
    for (const def of defs) {
      map[def.type] = def;
      for (const alias of def.aliases ?? []) {
        map[alias] = def;
      }
    }
    return map;
  }

  private extractDefinitionsFromCss(css: string): CalloutDefinition[] {
    const defs: CalloutDefinition[] = [];
    if (!css) return defs;
    const ruleRegex = /\.callout\[data-callout[^{]+\{[^}]*\}/gms;
    const iconRegex = /--callout-icon\s*:\s*([^;]+);?/i;

    let match: RegExpExecArray | null;
    while ((match = ruleRegex.exec(css)) !== null) {
      const rule = match[0];
      const selectorPart = rule.slice(0, rule.indexOf('{'));
      const body = rule.slice(rule.indexOf('{') + 1, rule.lastIndexOf('}'));

      const names = Array.from(selectorPart.matchAll(/data-callout=['"]?([^'"\]]+)['"]?/gi), (m) =>
        this.sanitizeCalloutType(m[1])
      );
      if (names.length === 0) continue;

      const [primary, ...aliases] = names;
      const iconMatch = body.match(iconRegex);
      const icon = iconMatch ? iconMatch[1].trim() : primary.charAt(0).toUpperCase();

      defs.push({
        type: primary,
        icon,
        label: this.capitalize(primary),
        aliases,
      });
    }

    return defs;
  }

  private escapeHtml(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private normalizeIconName(raw: string): string {
    const cleaned = raw
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    const aliases: Record<string, string> = {
      sticky_note: 'sticky_note_2',
      sticky_note_2: 'sticky_note_2',
      note: 'sticky_note_2',
      quote: 'format_quote',
      quotation_mark: 'format_quote',
      task: 'task_alt',
      checklist: 'task_alt',
      warning_amber: 'warning',
      danger: 'report',
    };
    return aliases[cleaned] ?? cleaned;
  }
}
