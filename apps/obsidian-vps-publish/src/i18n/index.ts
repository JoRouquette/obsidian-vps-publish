import type { App } from 'obsidian';

import { en, fr, type Locale, type Translations } from './locales';

export type { Translations } from './locales';

export type I18nSettings = {
  locale?: Locale | 'system';
};

export function detectSystemLocale(_app: App): Locale {
  const nav = navigator as Navigator & { userLanguage?: string };
  const lang = nav.language || nav.userLanguage || 'en';

  const lower = String(lang).toLowerCase();
  if (lower.startsWith('fr')) return 'fr';
  return 'en';
}

export function getTranslations(
  app: App,
  settings: I18nSettings
): {
  locale: Locale;
  t: Translations;
} {
  let locale: Locale;

  if (!settings || settings.locale === 'system' || !settings.locale) {
    locale = detectSystemLocale(app);
  } else {
    locale = settings.locale;
  }

  const t = locale === 'fr' ? fr : en;
  return { locale, t };
}
