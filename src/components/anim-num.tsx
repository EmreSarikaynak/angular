"use client";
import { useApp } from "./app-provider";
import { useCountUp } from "@/lib/use-count-up";
import { numberFmt } from "@/lib/i18n";

/** Değer değiştiğinde akarak güncellenen sayı. */
export function AnimNum({ value, digits = 0 }: { value: number; digits?: number }) {
  const { lang } = useApp();
  const v = useCountUp(value);
  return <>{numberFmt(lang, digits ? v : Math.round(v), digits)}</>;
}
