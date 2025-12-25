import type { App } from 'obsidian';

import { en, fr, type Locale, type Translations } from './locales';

export type { Translations } from './locales';

export type I18nSettings = {
  locale?: Locale | 'system';
};

// Type helper to extract nested keys from Translations
type PathImpl<T, Key extends keyof T> = Key extends string
  ? T[Key] extends Record<string, unknown>
    ? `${Key}.${PathImpl<T[Key], Exclude<keyof T[Key], keyof unknown[]>> & string}` | `${Key}`
    : `${Key}`
  : never;

type Path<T> = PathImpl<T, keyof T> | keyof T;

export type TranslationKey = Path<Translations>;

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

/**
 * Get translation by key with interpolation support
 * @param translations - Translations object (from getTranslations().t)
 * @param key - Dot-notation key path (e.g., 'plugin.commandPublish')
 * @param params - Optional parameters for interpolation {key: value}
 * @returns Translated string with interpolated values
 */
export function translate<K extends TranslationKey>(
  translations: Translations,
  key: K,
  params?: Record<string, string | number>
): string {
  const keys = key.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = translations;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Key not found, fallback to EN
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let enValue: any = en;
      for (const enKey of keys) {
        if (enValue && typeof enValue === 'object' && enKey in enValue) {
          enValue = enValue[enKey];
        } else {
          // Even EN fallback failed, return key itself
          if (typeof console !== 'undefined' && console.debug) {
            console.debug(`[i18n] Missing translation key: ${key}`);
          }
          return key as string;
        }
      }
      value = enValue;
      break;
    }
  }

  if (typeof value !== 'string') {
    if (typeof console !== 'undefined' && console.debug) {
      console.debug(`[i18n] Translation key is not a string: ${key}`);
    }
    return key as string;
  }

  // Apply interpolation if params provided
  if (params) {
    return Object.entries(params).reduce((str, [paramKey, paramValue]) => {
      return str.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
    }, value);
  }

  return value;
}
