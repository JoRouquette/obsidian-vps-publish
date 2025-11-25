import { IgnoreRule } from '@core-domain/publish';

export const DEFAULT_IGNORE_RULES: IgnoreRule[] = [
  { property: 'publish', ignoreIf: false },
  { property: 'draft', ignoreIf: true },
  { property: 'type', ignoreValues: ['Dashboard'] },
];
