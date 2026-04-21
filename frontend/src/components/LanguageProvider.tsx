"use client";

import Cookies from "js-cookie";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { DEFAULT_LOCALE, LOCALE_COOKIE_KEY, Locale, resolveLocale, t } from "@/lib/i18n";
import { getMe, updatePreferredLanguage } from "@/lib/admin-api";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  setLocaleAndPersist: (locale: Locale) => Promise<boolean>;
  tr: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);
const fallbackContext: LanguageContextValue = {
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  setLocaleAndPersist: async () => true,
  tr: (key: string) => t(DEFAULT_LOCALE, key),
};

function writeLocaleCookie(locale: Locale) {
  Cookies.set(LOCALE_COOKIE_KEY, locale, {
    expires: 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export function LanguageProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale?: string;
}) {
  const { data: session } = useSession();
  const [locale, setLocaleState] = useState<Locale>(resolveLocale(initialLocale ?? Cookies.get(LOCALE_COOKIE_KEY) ?? DEFAULT_LOCALE));

  useEffect(() => {
    const cookieLocale = resolveLocale(Cookies.get(LOCALE_COOKIE_KEY));
    setLocaleState(cookieLocale);
  }, []);

  useEffect(() => {
    async function syncFromProfile() {
      if (!session?.accessToken) return;
      try {
        const me = await getMe(session.accessToken);
        const profileLocale = resolveLocale(me.preferred_language);
        const cookieLocale = resolveLocale(Cookies.get(LOCALE_COOKIE_KEY));

        if (profileLocale === DEFAULT_LOCALE && cookieLocale !== DEFAULT_LOCALE) {
          await updatePreferredLanguage(session.accessToken, cookieLocale);
          setLocaleState(cookieLocale);
          writeLocaleCookie(cookieLocale);
          return;
        }

        setLocaleState(profileLocale);
        writeLocaleCookie(profileLocale);
      } catch {
        // Keep cookie/default locale when profile sync fails.
      }
    }
    void syncFromProfile();
  }, [session?.accessToken]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    writeLocaleCookie(nextLocale);
  }, []);

  const setLocaleAndPersist = useCallback(async (nextLocale: Locale) => {
    setLocale(nextLocale);
    if (!session?.accessToken) return true;

    try {
      await updatePreferredLanguage(session.accessToken, nextLocale);
      return true;
    } catch {
      return false;
    }
  }, [session?.accessToken, setLocale]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      setLocale,
      setLocaleAndPersist,
      tr: (key: string) => t(locale, key),
    }),
    [locale, setLocale, setLocaleAndPersist]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  return context ?? fallbackContext;
}
