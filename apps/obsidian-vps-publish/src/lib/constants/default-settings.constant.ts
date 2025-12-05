import { type PublishPluginSettings } from '@core-domain/entities';

import { defaultIgnoreRules } from './default-ignore-rules.constant';

export const defaultSettings: PublishPluginSettings & {
  locale?: PublishPluginSettings['locale'] | 'system';
} = {
  vpsConfigs: [],
  folders: [],
  locale: 'system',
  ignoreRules: defaultIgnoreRules,
};
