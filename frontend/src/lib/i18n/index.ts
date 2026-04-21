import { DEFAULT_LOCALE, LOCALE_COOKIE_KEY, SUPPORTED_LOCALES } from "./constants";
import en from "./messages/en";
import vi from "./messages/vi";
import type { Locale } from "./types";

type Messages = typeof en;

const dictionaries: Record<Locale, Messages> = {
  en,
  vi,
};

function getByPath(obj: unknown, path: string): string | undefined {
  const value = path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
  return typeof value === "string" ? value : undefined;
}

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && SUPPORTED_LOCALES.includes(value as Locale);
}

export function resolveLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function t(locale: Locale, key: string): string {
  const localized = getByPath(dictionaries[locale], key);
  if (localized) return localized;
  return getByPath(dictionaries[DEFAULT_LOCALE], key) ?? key;
}

export { DEFAULT_LOCALE, LOCALE_COOKIE_KEY, SUPPORTED_LOCALES };
export type { Locale };
