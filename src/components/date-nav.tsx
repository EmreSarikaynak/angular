"use client";
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useApp } from "./app-provider";
import { addDays, formatDate, toDateKey } from "@/lib/dates";

/** Seçili günü URL'deki ?date= parametresinde tutar (geçmiş günlere kayıt eklemek için). */
export function useDateParam(): [string, (d: string) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("date") ?? "";
  const today = toDateKey();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= today ? raw : today;
  const setDate = useCallback(
    (d: string) => {
      const next = d > toDateKey() ? toDateKey() : d;
      router.replace(next === toDateKey() ? pathname : `${pathname}?date=${next}`, { scroll: false });
    },
    [router, pathname],
  );
  return [date, setDate];
}

export function DateNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const { t, lang } = useApp();
  const today = toDateKey();
  const isToday = date === today;
  const title = isToday ? t("Bugün") : date === addDays(today, -1) ? t("Dün") : formatDate(date, lang, { day: "numeric", month: "long", weekday: "short" });
  return (
    <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl border border-border bg-surface p-1.5">
      <button type="button" onClick={() => onChange(addDays(date, -1))} aria-label={t("Önceki gün")} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-surface-2">
        <ChevronLeft size={20} />
      </button>
      <label className="relative flex-1 cursor-pointer text-center">
        <span className="block text-sm font-semibold">{title}</span>
        {isToday && <span className="block text-xs text-muted">{formatDate(date, lang, { day: "numeric", month: "long" })}</span>}
        <input type="date" value={date} max={today} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label={t("Tarih seç")} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      </label>
      <button type="button" onClick={() => onChange(addDays(date, 1))} disabled={isToday} aria-label={t("Sonraki gün")} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-surface-2 disabled:opacity-30">
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
