export interface SanitizationRules {
  /** Unique ID for this rule (to allow folders to ignore it) */
  id: string;

  /** Display name (key for translation or custom name) */
  name: string;

  /** Regex pattern */
  regex: string;

  /** Replacement string */
  replacement: string;

  /** Whether this rule is enabled */
  isEnabled: boolean;
}

export interface SanitizationRulesDefaults extends SanitizationRules {
  /** Whether this is a default/system rule */
  isDefault: boolean;

  /** Translation key for the rule name (optional, for default rules) */
  nameKey?: string;

  /** Translation key for the rule description (optional) */
  descriptionKey?: string;
}
