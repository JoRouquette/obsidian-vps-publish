import type { PublishableNote } from './PublishableNote';
import type { SanitizationRules } from './SanitizationRules';

export interface ContentSanitizer {
  sanitizeNote(
    note: PublishableNote,
    rules: SanitizationRules | undefined
  ): PublishableNote;
}
