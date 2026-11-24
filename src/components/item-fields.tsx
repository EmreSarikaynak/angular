"use client";
import { useRef, useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { useApp } from "./app-provider";
import { Field, Input, NumberInput, cx } from "./ui";
import { regram, type RegramBase } from "@/lib/nutrition/regram";
import type { FoodItem } from "@/lib/types";

export function blankItem(): FoodItem {
  return { name: "", quantity: null, unit: null, grams: null, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, sugar_g: 0, fiber_g: 0, salt_g: 0, alcohol_g: 0, confidence: null, is_estimated: false, data_source: "user" };
}

export function SourceBadges({ item }: { item: Pick<FoodItem, "is_estimated" | "data_source" | "confidence"> }) {
  const { t } = useApp();
  const src: Record<string, string> = { reference: t("Referans tablo"), ai: t("Yapay zekâ tahmini"), openfoodfacts: "Open Food Facts", label: t("Etiketten"), user: "" };
  const low = item.confidence != null && item.confidence < 0.5;
  return (
    <span className="flex flex-wrap gap-1">
      {src[item.data_source] && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted">{src[item.data_source]}</span>}
      {item.is_estimated && <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-semibold text-warn">{t("Tahmini")}</span>}
      {low && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-semibold text-danger">{t("Düşük güven")}</span>}
    </span>
  );
}

/** Tek bir yiyecek kaleminin tüm değerlerini düzenleme alanları. */
export function ItemFields({ item, onChange, onRemove, defaultOpen }: { item: FoodItem; onChange: (next: FoodItem) => void; onRemove?: () => void; defaultOpen?: boolean }) {
  const { t } = useApp();
  const [open, setOpen] = useState(!!defaultOpen);
  const set = (patch: Partial<FoodItem>) => onChange({ ...item, ...patch });
  const num = (v: number | null) => (v == null || !isFinite(v) || v < 0 ? 0 : v);

  // Gramaj değişince besin değerleri HER ZAMAN ilk (referans) değerden orantılanır; böylece "200" yazarken
  // 2 → 20 → 200 ara adımlarında yuvarlama birikmez ve alan silinip yeniden yazılınca değerler bozulmaz.
  const base = useRef<RegramBase | null>(null);
  function setGrams(g: number | null) {
    if (g == null || !(g > 0)) return set({ grams: g });
    const r = regram(item, g, base.current);
    base.current = r.base;
    onChange({ ...item, ...r.patch });
  }

  return (
    <div className={cx("rounded-2xl border bg-surface p-3", item.confidence != null && item.confidence < 0.5 ? "border-warn" : "border-border")}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Input value={item.name} onChange={(e) => set({ name: e.target.value })} placeholder={t("Yiyecek adı")} aria-label={t("Yiyecek adı")} maxLength={200} className="h-10 font-medium" />
          <div className="mt-1.5">
            <SourceBadges item={item} />
          </div>
        </div>
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label={t("Sil")} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-danger">
            <Trash2 size={18} />
          </button>
        )}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Field label={t("Miktar (g / ml)")}>
          <NumberInput value={item.grams} onChange={setGrams} min={0} max={5000} className="h-10" />
        </Field>
        <Field label={t("Kalori (kcal)")}>
          <NumberInput value={item.kcal} onChange={(v) => set({ kcal: num(v) })} min={0} className="h-10" />
        </Field>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Field label={t("Protein (g)")}>
          <NumberInput value={item.protein_g} onChange={(v) => set({ protein_g: num(v) })} min={0} step="0.1" className="h-10" />
        </Field>
        <Field label={t("Karbonhidrat (g)")}>
          <NumberInput value={item.carbs_g} onChange={(v) => set({ carbs_g: num(v) })} min={0} step="0.1" className="h-10" />
        </Field>
        <Field label={t("Yağ (g)")}>
          <NumberInput value={item.fat_g} onChange={(v) => set({ fat_g: num(v) })} min={0} step="0.1" className="h-10" />
        </Field>
      </div>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-2 flex items-center gap-1 text-xs font-medium text-muted">
        <ChevronDown size={14} className={cx("transition-transform", open && "rotate-180")} />
        {t("Şeker, lif, tuz")}
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Field label={t("Şeker (g)")}>
            <NumberInput value={item.sugar_g} onChange={(v) => set({ sugar_g: num(v) })} min={0} step="0.1" className="h-10" />
          </Field>
          <Field label={t("Lif (g)")}>
            <NumberInput value={item.fiber_g} onChange={(v) => set({ fiber_g: num(v) })} min={0} step="0.1" className="h-10" />
          </Field>
          <Field label={t("Tuz (g)")}>
            <NumberInput value={item.salt_g} onChange={(v) => set({ salt_g: num(v) })} min={0} step="0.01" className="h-10" />
          </Field>
        </div>
      )}
    </div>
  );
}
