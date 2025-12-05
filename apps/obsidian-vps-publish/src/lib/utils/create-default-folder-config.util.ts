import type { FolderConfig } from '@core-domain/entities';
import type {
  SanitizationRules,
  SanitizationRulesDefaults,
} from '@core-domain/entities/sanitization-rules';

export function defaultSanitizationRules(): SanitizationRulesDefaults[] {
  return [
    {
      id: 'remove-code-blocks',
      name: 'Remove fenced code blocks', // Fallback name
      nameKey: 'settings.cleanupRules.removeCodeBlocks.name',
      descriptionKey: 'settings.cleanupRules.removeCodeBlocks.description',
      regex: '```[\\s\\S]*?```|~~~[\\s\\S]*?~~~',
      replacement: '',
      isEnabled: true,
      isDefault: true,
    },
  ];
}

/**
 * Enriches cleanup rules by merging with default rules metadata.
 * This ensures existing rules get the latest translation keys and default flags.
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
