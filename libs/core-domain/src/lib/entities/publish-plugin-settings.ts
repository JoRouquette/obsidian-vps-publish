import type { FolderConfig } from './folder-config';
import type { IgnoreRule } from './ignore-rule';
import type { PluginLocale } from './plugin-locale';
import type { VpsConfig } from './vps-config';

export interface PublishPluginSettings {
  locale?: PluginLocale;
  vpsConfigs: VpsConfig[];
  ignoreRules?: IgnoreRule[];
  folders: FolderConfig[];
}
