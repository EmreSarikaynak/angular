import type { Lang } from "../types";
import { EN } from "./en";

export type Vars = Record<string, string | number>;

/**
 * Çeviri: kaynak dil Türkçe'dir ve metnin kendisi anahtardır.
 * İngilizce karşılıklar en.ts dosyasındadır; eksik anahtar testte yakalanır.
 */
export function translate(lang: Lang, text: string, vars?: Vars): string {
  let out = lang === "en" ? (EN[text] ?? text) : text;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

export function numberFmt(lang: Lang, n: number, digits = 0): string {
  return new Intl.NumberFormat(lang === "en" ? "en-GB" : "tr-TR", { maximumFractionDigits: digits }).format(n);
}
