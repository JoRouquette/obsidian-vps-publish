import { PublishPluginSettings } from '@core-domain/entities';
import { defaultIgnoreRules } from './default-ignore-rules.constant';

export const defaultSettings: PublishPluginSettings & { locale?: any } = {
  vpsConfigs: [],
  folders: [],
  locale: 'system',
  ignoreRules: defaultIgnoreRules,
};
