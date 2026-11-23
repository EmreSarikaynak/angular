"use client";
import { Suspense, useMemo, useState } from "react";
import { Coffee, GlassWater, Trash2, Wine } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { DateNav, useDateParam } from "@/components/date-nav";
import { Bar, Button, Card, Chip, Empty, Field, Input, NumberInput, PageHeader, Stat } from "@/components/ui";
import { useRange } from "@/lib/data/hooks";
import { deleteRow, upsertRow, uuid } from "@/lib/data/store";
import { addDays, timeOf, timestampFor, toDateKey } from "@/lib/dates";
import { numberFmt } from "@/lib/i18n";
import { DRINK_LABELS, label } from "@/lib/i18n/labels";
import { CAFFEINE_DAILY_LIMIT_MG, CAFFEINE_LATE_HOUR, DRINK_TYPES, caffeineMg, calcDrink, drinkType, standardDrinks } from "@/lib/nutrition/drinks";

function DrinksInner() {
  const { t, lang, toast } = useApp();
  const [date, setDate] = useDateParam();
  const weekFrom = addDays(date, -6);
  const range = useRange(weekFrom, date);
  const [type, setType] = useState("tea");
  const [volume, setVolume] = useState<number | null>(drinkType("tea").defaultMl);
  const [abv, setAbv] = useState<number | null>(0);
  const [sugar, setSugar] = useState<number | null>(0);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const dt = drinkType(type);
  const nf = (n: number, d = 0) => numberFmt(lang, n, d);
  const calc = useMemo(() => calcDrink({ type, volume_ml: volume ?? 0, abv: dt.alcoholic || type === "other" ? abv : 0, added_sugar_g: sugar ?? 0 }), [type, volume, abv, sugar, dt.alcoholic]);

  const caffeine = caffeineMg(type, volume ?? 0);
  const drinks = (range.data?.food ?? []).filter((f) => f.meal === "drink");
  const today = drinks.filter((f) => f.entry_date === date).sort((a, b) => b.consumed_at.localeCompare(a.consumed_at));
  const caffeineToday = today.reduce((n, f) => n + (f.caffeine_mg ?? 0), 0);
  const caffeineWeek = drinks.reduce((n, f) => n + (f.caffeine_mg ?? 0), 0);
  const lateCaffeine = today.some((f) => (f.caffeine_mg ?? 0) > 0 && new Date(f.consumed_at).getHours() >= CAFFEINE_LATE_HOUR);
  const sum = (list: typeof drinks, k: "kcal" | "sugar_g" | "alcohol_g") => list.reduce((s, f) => s + f[k], 0);

  function choose(key: string) {
    const d = drinkType(key);
    setType(key);
    setVolume(d.defaultMl);
    setAbv(d.abv);
    setSugar(0);
    setName("");
  }

  async function save() {
    if (!volume || volume <= 0 || volume > 5000) return toast(t("Miktar 1–5000 ml arasında olmalı."), "error");
    if (abv != null && (abv < 0 || abv > 96)) return toast(t("Alkol oranı 0–96 arasında olmalı."), "error");
    setBusy(true);
    try {
      const { queued } = await upsertRow("food_entries", {
        id: uuid(),
        entry_date: date,
        consumed_at: timestampFor(date),
        meal: "drink",
        name: (name.trim() || label(DRINK_LABELS, type, lang)).slice(0, 200),
        quantity: volume,
        unit: "ml",
        grams: volume,
        ...calc,
        source: "drink",
        data_source: "reference",
        is_estimated: type === "cocktail" || type === "other",
        confidence: null,
        photo_path: null,
        group_id: null,
        group_name: null,
        drink_type: type,
        volume_ml: volume,
        abv: calc.alcohol_g > 0 ? (abv ?? dt.abv) : null,
        caffeine_mg: caffeine,
        note: null,
      });
      toast(queued ? t("Cihaza kaydedildi; bağlantı gelince gönderilecek.") : t("İçecek eklendi."), queued ? "info" : "ok");
    } catch {
      toast(t("Kaydedilemedi."), "error");
    } finally {
      setBusy(false);
    }
  }

  const group = (alcoholic: boolean) => (
    <div className="flex flex-wrap gap-2">
      {DRINK_TYPES.filter((d) => d.alcoholic === alcoholic).map((d) => (
        <Chip key={d.key} active={type === d.key} onClick={() => choose(d.key)}>
          {label(DRINK_LABELS, d.key, lang)}
        </Chip>
      ))}
    </div>
  );

  return (
    <div>
      <PageHeader title={t("İçecekler")} subtitle={t("Alkollü ve diğer içecekler")} />
      <DateNav date={date} onChange={setDate} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <Field label={t("Alkolsüz")}>{group(false)}</Field>
          <Field label={t("Alkollü")}>{group(true)}</Field>
          {type === "other" && (
            <Field label={t("İçecek adı")}>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </Field>
          )}
          <Field label={t("Miktar (ml)")}>
            <NumberInput value={volume} onChange={setVolume} min={1} max={5000} />
          </Field>
          <div className="flex flex-wrap gap-2">
            {dt.servings.map((ml) => (
              <Chip key={ml} active={volume === ml} onClick={() => setVolume(ml)}>
                {ml} ml
              </Chip>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(dt.alcoholic || type === "other") && (
              <Field label={t("Alkol oranı (%)")}>
                <NumberInput value={abv} onChange={setAbv} min={0} max={96} step="0.1" />
              </Field>
            )}
            {!dt.alcoholic && (
              <Field label={t("Eklenen şeker (g)")} hint={t("1 küp şeker ≈ 2,5 g")}>
                <NumberInput value={sugar} onChange={setSugar} min={0} max={200} step="0.5" />
              </Field>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-surface-2 p-3 text-center">
            <Stat label={t("Kalori")} value={nf(calc.kcal)} unit="kcal" />
            <Stat label={t("Şeker")} value={nf(calc.sugar_g, 1)} unit="g" />
            {caffeine > 0 ? <Stat label={t("Kafein")} value={nf(caffeine)} unit="mg" /> : <Stat label={t("Saf alkol")} value={nf(calc.alcohol_g, 1)} unit="g" />}
          </div>
          {caffeine > 0 && date === toDateKey() && new Date().getHours() >= CAFFEINE_LATE_HOUR && <p className="rounded-xl bg-warn/10 px-3 py-2 text-xs text-warn">{t("Saat {h}:00'dan sonra alınan kafein uykunuzu etkileyebilir.", { h: CAFFEINE_LATE_HOUR })}</p>}
          <Button size="lg" className="w-full" loading={busy} onClick={save}>
            {t("İçeceği ekle")}
          </Button>
          <p className="text-xs text-muted">{t("İçecek kalorileri günlük toplam kalorinize eklenir. İçecekler su tüketimi olarak sayılmaz.")}</p>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="mb-2 flex items-baseline justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Coffee size={16} className="text-muted" />
                {t("Günün kafeini")}
              </p>
              <p className={`text-sm font-semibold ${caffeineToday > CAFFEINE_DAILY_LIMIT_MG ? "text-danger" : ""}`}>
                {nf(caffeineToday)} / {CAFFEINE_DAILY_LIMIT_MG} mg
              </p>
            </div>
            <Bar value={caffeineToday} max={CAFFEINE_DAILY_LIMIT_MG} color={caffeineToday > CAFFEINE_DAILY_LIMIT_MG ? "var(--danger)" : "var(--carbs)"} />
            <p className="mt-2 text-xs text-muted">
              {caffeineToday > CAFFEINE_DAILY_LIMIT_MG ? t("Yetişkinler için önerilen günlük üst sınırı (400 mg) aştınız.") : t("Yetişkinler için önerilen günlük üst sınır 400 mg'dır. Son 7 gün ortalaması: {n} mg", { n: nf(caffeineWeek / 7) })}
              {lateCaffeine ? ` ${t("Bugün saat {h}:00'dan sonra kafein aldınız.", { h: CAFFEINE_LATE_HOUR })}` : ""}
            </p>
          </Card>
          <Card>
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Wine size={16} className="text-muted" />
              {t("Tüketim özeti")}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Stat label={t("Bugün · kalori")} value={nf(sum(today, "kcal"))} unit="kcal" />
              <Stat label={t("Son 7 gün · kalori")} value={nf(sum(drinks, "kcal"))} unit="kcal" />
              <Stat label={t("Bugün · şeker")} value={nf(sum(today, "sugar_g"), 1)} unit="g" />
              <Stat label={t("Son 7 gün · şeker")} value={nf(sum(drinks, "sugar_g"), 1)} unit="g" />
              <Stat label={t("Bugün · saf alkol")} value={nf(sum(today, "alcohol_g"), 1)} unit="g" />
              <Stat label={t("Son 7 gün · saf alkol")} value={nf(sum(drinks, "alcohol_g"), 1)} unit="g" />
            </div>
            <p className="mt-3 text-xs text-muted">
              {t("Son 7 günde yaklaşık {n} standart içki (1 standart içki = 10 g saf alkol).", { n: nf(standardDrinks(sum(drinks, "alcohol_g")), 1) })}
            </p>
          </Card>

          <Card className="p-0">
            <p className="px-4 py-3 text-sm font-semibold">{t("Günün içecekleri")}</p>
            {today.length === 0 ? (
              <Empty icon={<GlassWater size={22} />} title={t("Bu gün için içecek kaydı yok")} />
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {today.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{d.name}</p>
                      <p className="truncate text-xs text-muted">
                        {timeOf(d.consumed_at)} · {nf(d.volume_ml ?? d.grams ?? 0)} ml · {nf(d.kcal)} kcal
                        {d.alcohol_g > 0 ? ` · ${t("alkol")} ${nf(d.alcohol_g, 1)} g` : ""}
                        {(d.caffeine_mg ?? 0) > 0 ? ` · ${t("kafein")} ${nf(d.caffeine_mg ?? 0)} mg` : ""}
                      </p>
                    </div>
                    <button type="button" aria-label={t("Sil")} onClick={() => deleteRow("food_entries", d.id).catch(() => toast(t("Silinemedi."), "error"))} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:text-danger">
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function DrinksPage() {
  return (
    <Suspense>
      <DrinksInner />
    </Suspense>
  );
}
