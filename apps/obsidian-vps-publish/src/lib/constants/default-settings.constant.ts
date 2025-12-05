import { type PublishPluginSettings } from '@core-domain/entities';

export const defaultSettings: PublishPluginSettings & {
  locale?: 'en' | 'fr' | 'system';
} = {
  vpsConfigs: [],
  locale: 'system',
};
