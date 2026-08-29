import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type LanguageCode = "pt-BR" | "en-US" | "es-ES";

export type LanguageOption = {
  code: LanguageCode;
  label: string;
  short: string;
  currency: string;
  available: boolean;
};

export const LANGUAGES: LanguageOption[] = [
  { code: "pt-BR", label: "Português (Brasil)", short: "PT", currency: "BRL", available: true },
  { code: "en-US", label: "English (US)", short: "EN", currency: "USD", available: false },
  { code: "es-ES", label: "Español", short: "ES", currency: "EUR", available: false },
];

export const DEFAULT_LANGUAGE: LanguageCode = "pt-BR";
const STORAGE_KEY = "beyond-language";

/**
 * Locale ativo em módulo, para que utilitários de formatação fora da árvore React
 * (ex.: helpers de dados) sigam o idioma escolhido.
 */
let activeLanguage: LanguageCode = DEFAULT_LANGUAGE;

export function getActiveLanguage(): LanguageCode {
  return activeLanguage;
}

function optionFor(code: LanguageCode) {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

export function formatMoney(value: number, code: LanguageCode = activeLanguage) {
  const { currency } = optionFor(code);
  return value.toLocaleString(code, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
}

export function formatNumber(value: number, code: LanguageCode = activeLanguage) {
  return value.toLocaleString(code);
}

export function formatPercent(value: number, code: LanguageCode = activeLanguage) {
  return value.toLocaleString(code, { style: "percent", maximumFractionDigits: 1 });
}

export function formatDate(value: Date | string | number, code: LanguageCode = activeLanguage) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(code, { day: "numeric", month: "long", year: "numeric" });
}

type LanguageContextValue = {
  language: LanguageCode;
  option: LanguageOption;
  setLanguage: (code: LanguageCode) => void;
  money: (value: number) => string;
  number: (value: number) => string;
  percent: (value: number) => string;
  date: (value: Date | string | number) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
    const valid = LANGUAGES.find((l) => l.code === stored && l.available);
    if (valid) {
      activeLanguage = valid.code;
      setLanguageState(valid.code);
    }
  }, []);

  const setLanguage = useCallback((code: LanguageCode) => {
    const option = optionFor(code);
    if (!option.available) return;
    activeLanguage = option.code;
    localStorage.setItem(STORAGE_KEY, option.code);
    setLanguageState(option.code);
    document.documentElement.lang = option.code;
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      option: optionFor(language),
      setLanguage,
      money: (v) => formatMoney(v, language),
      number: (v) => formatNumber(v, language),
      percent: (v) => formatPercent(v, language),
      date: (v) => formatDate(v, language),
    }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage precisa estar dentro de LanguageProvider");
  return ctx;
}
