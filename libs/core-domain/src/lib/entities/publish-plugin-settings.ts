import { FolderConfig } from './folder-config';
import { IgnoreRule } from './ignore-rule';
import { PluginLocale } from './plugin-locale';
import { VpsConfig } from './vps-config';

export interface PublishPluginSettings {
  locale?: PluginLocale;
  vpsConfigs: VpsConfig[];
  ignoreRules?: IgnoreRule[];
  folders: FolderConfig[];
}
