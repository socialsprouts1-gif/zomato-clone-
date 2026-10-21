"use client";

import { createContext, useContext, useMemo } from "react";
import { makeTranslator, type Locale, type Translator } from "./dictionaries";

const I18nContext = createContext<{ locale: Locale; t: Translator }>({ locale: "en", t: makeTranslator("en") });

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, t: makeTranslator(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext);
}
