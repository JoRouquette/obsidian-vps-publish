import { PublishableNote } from '@core-domain/publish/PublishableNote';
import { ContentSanitizer } from '@core-domain/publish/ContentSanitizer';
import { SanitizationRules } from '@core-domain/publish/SanitizationRules';
import { SanitizeMarkdownUseCase } from '../usecases/sanitize-markdown.usecase';

export class DefaultContentSanitizer implements ContentSanitizer {
  private readonly sanitizeMarkdown = new SanitizeMarkdownUseCase();

  sanitizeNote(
    note: PublishableNote,
    rules: SanitizationRules | null | undefined
  ): PublishableNote {
    if (!rules) {
      return note;
    }

    const { markdown } = this.sanitizeMarkdown.execute(note.content, rules);

    return {
      ...note,
      content: markdown,
    };
  }
}
