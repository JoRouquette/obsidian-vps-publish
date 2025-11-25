import { PublishPluginSettings } from '@core-domain/publish';
import { DEFAULT_IGNORE_RULES } from './DEFAULT_IGNORE_RULES';

const DEFAULT_SETTINGS: PublishPluginSettings & { locale?: any } = {
  vpsConfigs: [],
  folders: [],
  locale: 'system',
  ignoreRules: DEFAULT_IGNORE_RULES,
};
