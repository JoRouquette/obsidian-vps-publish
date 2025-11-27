import { IgnoreRule } from '@core-domain/entities';

export const defaultIgnoreRules: IgnoreRule[] = [
  { property: 'publish', ignoreIf: false },
  { property: 'draft', ignoreIf: true },
  { property: 'type', ignoreValues: ['Dashboard'] },
];
