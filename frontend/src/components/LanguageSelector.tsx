"use client";

import { Locale } from "@/lib/i18n";
import { useLanguage } from "./LanguageProvider";

interface LanguageSelectorProps {
  className?: string;
  persistToProfile?: boolean;
}

export function LanguageSelector({ className, persistToProfile = false }: LanguageSelectorProps) {
  const { locale, setLocale, setLocaleAndPersist, tr } = useLanguage();

  async function handleChange(nextLocale: Locale) {
    if (persistToProfile) {
      await setLocaleAndPersist(nextLocale);
      return;
    }
    setLocale(nextLocale);
  }

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <label htmlFor="language-select" className="text-xs text-muted-foreground">
        {tr("common.language")}
      </label>
      <select
        id="language-select"
        value={locale}
        onChange={(e) => void handleChange(e.target.value as Locale)}
        className="bg-background/50 border border-border/50 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
      >
        <option value="en">{tr("common.english")}</option>
        <option value="vi">{tr("common.vietnamese")}</option>
      </select>
    </div>
  );
}
