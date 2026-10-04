import type { FolderConfig } from '@core-domain/entities';
import type {
  SanitizationRules,
  SanitizationRulesDefaults,
} from '@core-domain/entities/sanitization-rules';

const REMOVE_CODE_BLOCKS_RULE_ID = 'remove-code-blocks';

/**
 * One alternative of REMOVE_CODE_BLOCKS_REGEX, for one fence character.
 *
 * - `(?=```)` first: the lookbehind that follows is only evaluated where a fence can
 *   start. Without it, every position of a long line of spaces or `>` re-reads the
 *   line backwards, which is quadratic.
 * - The lookbehind accepts blockquote markers (`> `, `> > `) then an optional list
 *   marker (`- `, `1. `) before the opening fence, so blocks inside callouts, quotes
 *   and list items are removed. The markers stay on the line: removing them would
 *   leave an empty line, which ends the callout and pushes what follows out of it.
 *   It also refuses to start in the middle of a fence.
 * - The captured blockquote markers are required, verbatim, at the start of every
 *   body line and of the closing line. A quoted block left open stops matching where
 *   the quote ends, so it can no longer swallow published text up to a later fence.
 * - The opening cannot give back fence characters to close earlier on a shorter
 *   fence: the backtick info string cannot contain a backtick (CommonMark rule), and
 *   `(?!~)` forbids a tilde right after the tilde fence. Tildes remain allowed
 *   further in a tilde info string, as in CommonMark.
 */
function fencedBlockPattern(fenceChar: '`' | '~', groupSuffix: string): string {
  const quote = `quote${groupSuffix}`;
  const fence = `fence${groupSuffix}`;
  const infoString = fenceChar === '`' ? '[^`\\n]*' : '(?!~)[^\\n]*';
  const listMarker = String.raw`(?:(?:[-*+]|\d{1,9}[.)])[ \t]+)?`;

  return (
    `(?=${fenceChar}{3})` +
    String.raw`(?<=^(?<${quote}>(?:[ \t]*>)*)[ \t]*${listMarker})` +
    `(?<${fence}>${fenceChar}{3,})${infoString}\\n` +
    String.raw`(?:\k<${quote}>[^\n]*\n)*?` +
    String.raw`\k<${quote}>[ \t]*\k<${fence}>${fenceChar}*[ \t]*\r?$`
  );
}

/**
 * Removes fenced code blocks the way CommonMark (and Obsidian) delimits them: a fence
 * of 3+ backticks or tildes, closed by a fence of the same character, at least as
 * long, alone on its line. Compiled with the `gm` flags by ContentSanitizerService.
 * See fencedBlockPattern for the details.
 *
 * Known limits, kept on purpose:
 * - Blockquote markers are compared verbatim: a block opened with `> > ` and closed
 *   with `>> ` is left in place. A quote opened inside a list item (`- > `) is not
 *   recognised either.
 * - A block left open in a list item is not stopped at the end of the item: it can
 *   pair with a later top-level fence, as with the former default.
 * - The closing fence indentation is not limited to three spaces.
 * - An opening that never finds its closing fence scans the rest of its quote, or of
 *   the note at top level, so many such openings in one note are quadratic.
 *
 * Built with `new RegExp` at module load, so a syntax error fails there instead of
 * being swallowed by ContentSanitizerService.compileRules. The stored setting is the
 * source string.
 */
export const REMOVE_CODE_BLOCKS_REGEX: string = new RegExp(
  `${fencedBlockPattern('`', 'Backtick')}|${fencedBlockPattern('~', 'Tilde')}`,
  'gm'
).source;

/**
 * Former default of the rule. It stopped at the first three backticks of the closing
 * fence: a block closed by four backticks left a stray backtick on the published page.
 * Stored settings still holding this exact value are migrated by enrichCleanupRules.
 */
export const LEGACY_REMOVE_CODE_BLOCKS_REGEX = '```[\\s\\S]*?```|~~~[\\s\\S]*?~~~';

/**
 * Former default values of each default rule, by rule id. A stored rule whose regex
 * is listed here was never edited by the user and can follow the current default.
 */
const LEGACY_DEFAULT_REGEXES: Readonly<Record<string, readonly string[]>> = {
  [REMOVE_CODE_BLOCKS_RULE_ID]: [LEGACY_REMOVE_CODE_BLOCKS_REGEX],
};

function upgradeLegacyDefaultRegex(
  rule: SanitizationRules,
  defaultRule: SanitizationRules
): string {
  const legacyValues = LEGACY_DEFAULT_REGEXES[rule.id] ?? [];
  return legacyValues.includes(rule.regex) ? defaultRule.regex : rule.regex;
}

export function defaultSanitizationRules(): SanitizationRulesDefaults[] {
  return [
    {
      id: REMOVE_CODE_BLOCKS_RULE_ID,
      name: 'Remove fenced code blocks', // Fallback name
      nameKey: 'settings.cleanupRules.removeCodeBlocks.name',
      descriptionKey: 'settings.cleanupRules.removeCodeBlocks.description',
      regex: REMOVE_CODE_BLOCKS_REGEX,
      replacement: '',
      isEnabled: true,
      isDefault: true,
    },
  ];
}

/**
 * Enriches cleanup rules by merging with default rules metadata.
 * This ensures existing rules get the latest translation keys and default flags.
 *
 * It also upgrades the regex of a default rule when it still holds one of its former
 * defaults verbatim (LEGACY_DEFAULT_REGEXES). A regex the user edited is left untouched.
 */
export function enrichCleanupRules(
  rules: (SanitizationRules | SanitizationRulesDefaults)[]
): (SanitizationRules | SanitizationRulesDefaults)[] {
  const defaults = defaultSanitizationRules();
  const defaultsMap = new Map(defaults.map((r) => [r.id, r]));

  return rules.map((rule) => {
    const defaultRule = defaultsMap.get(rule.id);
    if (defaultRule) {
      // Merge with default rule to get translation keys and isDefault flag
      return {
        ...defaultRule,
        ...rule,
        regex: upgradeLegacyDefaultRegex(rule, defaultRule),
        // Ensure these properties come from default
        nameKey: defaultRule.nameKey,
        descriptionKey: defaultRule.descriptionKey,
        isDefault: defaultRule.isDefault,
      };
    }
    return rule;
  });
}

export function createDefaultFolderConfig(
  vpsId: string,
  overrideDefaults: Partial<FolderConfig> = {}
): FolderConfig {
  const defaults: FolderConfig = {
    id: `folder-${Date.now()}`,
    vaultFolder: '',
    routeBase: '',
    vpsId,
    ignoredCleanupRuleIds: [],
  };
  return {
    ...defaults,
    ...overrideDefaults,
  };
}
