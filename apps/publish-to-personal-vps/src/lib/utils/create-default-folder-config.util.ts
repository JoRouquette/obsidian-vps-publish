import type { FolderConfig } from '@core-domain/entities';
import type { SanitizationRulesDefaults } from '@core-domain/entities/sanitization-rules';

export function defaultSanitizationRules(): SanitizationRulesDefaults[] {
  return [
    {
      name: 'Remove fenced code blocks',
      regex: '```[\\s\\S]*?```|~~~[\\s\\S]*?~~~',
      replacement: '',
      isEnabled: true,
      isDefault: true,
    },
  ];
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
    sanitization: defaultSanitizationRules(),
  };
  return {
    ...defaults,
    ...overrideDefaults,
  };
}
