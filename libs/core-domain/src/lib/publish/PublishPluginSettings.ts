import { FolderConfig } from './FolderConfig';
import { IgnoreRule } from './IgnoreRule';
import { PluginLocale } from './PluginLocale';
import { VpsConfig } from './VpsConfig';

export interface PublishPluginSettings {
  locale?: PluginLocale;
  vpsConfigs: VpsConfig[];
  ignoreRules?: IgnoreRule[];
  folders: FolderConfig[];
}
