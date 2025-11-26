export interface SanitizationRules {
  name: string;
  regex: RegExp | string;
  replacement: string;
  isEnabled: boolean;
}

export interface SanitizationRulesDefaults extends SanitizationRules {
  isDefault: boolean;
}
