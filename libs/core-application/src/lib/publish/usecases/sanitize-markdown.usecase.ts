import type { SanitizationRules } from '@core-domain/publish/SanitizationRules';

export interface SanitizeMarkdownOutput {
  markdown: string;
  appliedRules: (keyof SanitizationRules)[];
}

const FENCED_CODE_BLOCK_REGEX = /```[\s\S]*?```|~~~[\s\S]*?~~~/g;

export class SanitizeMarkdownUseCase {
  execute(
    markdown: string,
    rules: SanitizationRules | null | undefined
  ): SanitizeMarkdownOutput {
    if (!rules) {
      return { markdown, appliedRules: [] };
    }

    let result = markdown;
    const applied: (keyof SanitizationRules)[] = [];

    if (rules.removeFencedCodeBlocks) {
      const before = result;
      result = result.replace(FENCED_CODE_BLOCK_REGEX, '');
      if (before !== result) {
        applied.push('removeFencedCodeBlocks');
      }
    }

    return { markdown: result, appliedRules: applied };
  }
}
