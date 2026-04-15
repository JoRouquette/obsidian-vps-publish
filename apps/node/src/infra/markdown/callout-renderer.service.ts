import type MarkdownIt from 'markdown-it';
import { type Token } from 'markdown-it';

export type CalloutFold = 'open' | 'closed';

export interface CalloutMeta {
  type: string;
  label: string;
  icon: string;
  color?: string;
  title: string;
  isFoldable: boolean;
  fold: CalloutFold | null;
  inlineBodyHtml?: string;
}

export interface CalloutDefinition {
  type: string;
  label: string;
  icon: string;
  color?: string;
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
  { type: 'tip', label: 'Tip', icon: 'lightbulb', aliases: ['hint', 'important'] },
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

  extendDefinitions(defs: CalloutDefinition[]): void {
    for (const def of defs) {
      const type = this.sanitizeCalloutType(def.type);
      const existing = this.lookup[type];
      if (existing) {
        existing.icon = def.icon || existing.icon;
        existing.color = def.color || existing.color;
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
          icon: def.icon || type,
          color: def.color,
          aliases: (def.aliases ?? []).map(this.sanitizeCalloutType),
        };
        this.definitions.push(normalized);
      }
    }
    this.lookup = this.buildLookup(this.definitions);
  }

  extendFromStyles(styles: CalloutStylePayload[]): CalloutDefinition[] {
    // Uploaded Obsidian CSS is parsed only to recover custom callout type/icon metadata.
    // The site frontend owns callout presentation, so the raw CSS is not re-emitted.
    const defs = styles.flatMap((s) => this.extractDefinitionsFromCss(s.css));
    if (defs.length > 0) {
      this.extendDefinitions(defs);
    }
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
      const styleAttr = callout.color
        ? ` style="--callout-color: ${this.escapeHtml(callout.color)}"`
        : '';
      const bodyHtml = callout.inlineBodyHtml ?? '';

      const bodySlot = bodyHtml ? `${bodyHtml}\n` : '';

      if (callout.isFoldable) {
        const foldAttr = ` data-callout-fold="${callout.fold}"`;
        const openAttr = callout.fold !== 'closed' ? ' open' : '';
        return `<details class="callout"${typeAttr}${foldAttr}${openAttr}${styleAttr}>
<summary class="callout-title">
  <span class="callout-icon material-symbols-outlined" data-icon="${this.escapeHtml(iconName)}" aria-hidden="true">${this.escapeHtml(iconName)}</span>
  <span class="callout-label">${titleHtml}</span>
</summary>
<div class="callout-content">
${bodySlot}`;
      }

      return `<div class="callout"${typeAttr}${styleAttr}>
  <div class="callout-title">
    <span class="callout-icon material-symbols-outlined" data-icon="${this.escapeHtml(iconName)}" aria-hidden="true">${this.escapeHtml(iconName)}</span>
    <span class="callout-label">${titleHtml}</span>
  </div>
  <div class="callout-content">
${bodySlot}`;
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
        icon: rawType,
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
      color: typeInfo.color,
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
    // Only match top-level callout rules (e.g. `.callout[data-callout='x']` or
    // `.callout[data-callout='x'], .callout[data-callout='y']`).
    // Sub-selector rules like `.callout[data-callout='x'] .callout-title` are
    // intentionally excluded: they carry no icon information and would overwrite
    // the icon extracted from the main rule with the type-name fallback.
    const ruleRegex =
      /\.callout\[data-callout[^\]]+\](?:\s*,\s*\.callout\[data-callout[^\]]+\])*\s*\{[^}]*\}/gms;
    const iconRegex = /--callout-icon\s*:\s*([^;]+);?/i;
    const colorRegex = /--callout-color\s*:\s*([^;]+);?/i;

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
      const icon = iconMatch ? iconMatch[1].trim() : primary;
      const colorMatch = body.match(colorRegex);
      const color = colorMatch ? this.normalizeColor(colorMatch[1]) : undefined;

      defs.push({
        type: primary,
        icon,
        color,
        label: this.capitalize(primary),
        aliases,
      });
    }

    return defs;
  }

  /**
   * Normalise la valeur de --callout-color extraite du CSS Obsidian.
   * Obsidian stocke les couleurs en composantes R, G, B séparées (ex. "0, 184, 212")
   * pour permettre rgba(var(--callout-color), 0.3). On les convertit en rgb() complet
   * pour que le site puisse les utiliser directement dans color-mix() et comme valeur CSS.
   */
  private normalizeColor(raw: string): string {
    const trimmed = raw.trim();
    // Format Obsidian : "R, G, B" sans les parenthèses
    if (/^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}$/.test(trimmed)) {
      return `rgb(${trimmed})`;
    }
    // Déjà une couleur CSS valide (hex, named, rgb(), hsl(), oklch()…)
    return trimmed;
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

    // Strip the `lucide_` prefix used by many Obsidian themes — the remaining
    // base name often matches a Material Symbols icon directly (e.g. list, star,
    // bookmark, shield …). Cases that diverge are handled by the alias table below.
    const baseName = cleaned.startsWith('lucide_') ? cleaned.slice(7) : cleaned;

    const aliases: Record<string, string> = {
      // Legacy / generic
      sticky_note: 'sticky_note_2',
      note: 'sticky_note_2',
      quote: 'format_quote',
      quotation_mark: 'format_quote',
      task: 'task_alt',
      warning_amber: 'warning',
      danger: 'report',
      // Lucide base names that differ from Material Symbols
      alert_triangle: 'warning',
      alert_circle: 'error',
      x_circle: 'cancel',
      check_circle_2: 'check_circle',
      help_circle: 'help',
      file_text: 'description',
      file_edit: 'edit_document',
      map_pin: 'place',
      graduation_cap: 'school',
      list_checks: 'checklist',
      list_todo: 'checklist',
      refresh_cw: 'refresh',
      rotate_cw: 'rotate_right',
      rotate_ccw: 'rotate_left',
      maximize: 'fullscreen',
      minimize: 'fullscreen_exit',
      more_horizontal: 'more_horiz',
      more_vertical: 'more_vert',
      external_link: 'open_in_new',
      layout: 'dashboard',
      volume_2: 'volume_up',
      arrow_right: 'arrow_forward',
      arrow_left: 'arrow_back',
      arrow_up: 'arrow_upward',
      arrow_down: 'arrow_downward',
      chevron_up: 'expand_less',
      chevron_down: 'expand_more',
      x: 'close',
      plus: 'add',
      minus: 'remove',
      trash: 'delete',
      trash_2: 'delete',
      flame: 'local_fire_department',
      zap: 'bolt',
      pen_tool: 'draw',
      tool: 'build',
      wrench: 'build',
      package: 'inventory_2',
      tags: 'sell',
      eye_off: 'visibility_off',
      users: 'group',
      user: 'person',
      git_branch: 'device_hub',
      git_pull_request: 'call_merge',
      hard_drive: 'storage',
      cpu: 'memory',
      server: 'dns',
      brain: 'psychology',
      spell_check: 'spellcheck',
      // Calendar: lucide uses bare 'calendar', Material Symbols uses 'calendar_today'
      calendar: 'calendar_today',
      // Lucide icons that have no direct Material Symbols match
      bomb: 'dangerous',
      gem: 'diamond',
      toggle_right: 'toggle_on',
      toggle_left: 'toggle_off',
      logs: 'format_list_bulleted',
    };

    return aliases[baseName] ?? baseName;
  }
}
