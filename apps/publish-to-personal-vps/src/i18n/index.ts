import type { App } from 'obsidian';
import { en, fr, type Locale, type Translations } from './locales';

export type I18nSettings = {
  locale?: Locale | 'system';
};

export function detectSystemLocale(app: App): Locale {
  const lang =
    (navigator as any).language || (navigator as any).userLanguage || 'en';

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
