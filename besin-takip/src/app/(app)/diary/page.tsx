"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { Activity as ActivityIcon, Camera, Copy, Droplets, Flame, Moon, Plus, Trash2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { DateNav, useDateParam } from "@/components/date-nav";
import { ItemFields, SourceBadges } from "@/components/item-fields";
import { Button, Card, Chip, Field, Input, PageHeader, Sheet, Skeleton } from "@/components/ui";
import { useDay } from "@/lib/data/hooks";
import { deleteRow, upsertRow, upsertRows, uuid } from "@/lib/data/store";
import { summarizeDay } from "@/lib/day";
import { addDays, timeOf, timestampFor, toDateKey } from "@/lib/dates";
import { numberFmt } from "@/lib/i18n";
import { ACTIVITY_LABELS, MEAL_LABELS, label } from "@/lib/i18n/labels";
import { supabase } from "@/lib/supabase/client";
import type { FoodEntry, FoodItem, Meal } from "@/lib/types";
import { MEALS } from "@/lib/types";

function Photo({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase()
      .storage.from("meal-photos")
      .createSignedUrl(path, 3600)
      .then(({ data }) => alive && setUrl(data?.signedUrl ?? null));
    return () => {
      alive = false;
    };
  }, [path]);
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="mb-3 max-h-52 w-full rounded-2xl object-cover" />;
}

function stripForCopy(e: FoodEntry, date: string, groupId: string | null): FoodEntry {
  return { ...e, id: uuid(), entry_date: date, consumed_at: timestampFor(date, timeOf(e.consumed_at)), group_id: groupId, photo_path: null, user_id: undefined, created_at: undefined };
}

function DiaryInner() {
  const { t, lang, profile, toast } = useApp();
  const [date, setDate] = useDateParam();
  const day = useDay(date);
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const [copying, setCopying] = useState<{ entries: FoodEntry[]; title: string } | null>(null);
  const [copyDate, setCopyDate] = useState(toDateKey());
  const [busy, setBusy] = useState(false);

  const data = day.data ?? { food: [], water: [], activities: [], daily: [] };
  const s = summarizeDay(date, data, profile);
  const nf = (n: number, d = 0) => numberFmt(lang, n, d);
  const daily = data.daily[0];

  async function saveEdit() {
    if (!editing || !editing.name.trim()) return;
    setBusy(true);
    try {
      const { user_id: _u, created_at: _c, ...row } = editing as FoodEntry & { updated_at?: string };
      delete (row as { updated_at?: string }).updated_at;
      await upsertRow("food_entries", { ...row, kcal: Math.round(row.kcal), name: row.name.trim() });
      toast(t("Kayıt güncellendi."));
      setEditing(null);
    } catch {
      toast(t("Kaydedilemedi. Değerleri kontrol edip tekrar deneyin."), "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(e: FoodEntry) {
    if (!confirm(t("“{name}” silinsin mi?", { name: e.name }))) return;
    try {
      await deleteRow("food_entries", e.id);
      setEditing(null);
      toast(t("Kayıt silindi."));
    } catch {
      toast(t("Silinemedi."), "error");
    }
  }

  async function doCopy() {
    if (!copying) return;
    setBusy(true);
    try {
      const gid = copying.entries.length > 1 ? uuid() : null;
      await upsertRows(
        "food_entries",
        copying.entries.map((e) => {
          const { updated_at: _x, ...clean } = stripForCopy(e, copyDate, gid) as FoodEntry & { updated_at?: string };
          return clean;
        }),
      );
      toast(t("{n} kayıt kopyalandı.", { n: copying.entries.length }));
      setCopying(null);
    } catch {
      toast(t("Kopyalanamadı."), "error");
    } finally {
      setBusy(false);
    }
  }

  const asItem = (e: FoodEntry): FoodItem => ({ name: e.name, quantity: e.quantity, unit: e.unit, grams: e.grams, kcal: e.kcal, protein_g: e.protein_g, carbs_g: e.carbs_g, fat_g: e.fat_g, sugar_g: e.sugar_g, fiber_g: e.fiber_g, salt_g: e.salt_g, alcohol_g: e.alcohol_g, confidence: e.confidence, is_estimated: e.is_estimated, data_source: e.data_source });

  return (
    <div>
      <PageHeader title={t("Günlük")} />
      <DateNav date={date} onChange={setDate} />

      <Card className="mb-4 grid grid-cols-4 gap-2 text-center">
        {[
          [t("Alınan"), nf(s.intake.kcal), "kcal"],
          [t("Kalan"), nf(s.remaining_kcal), "kcal"],
          [t("Yakılan"), nf(s.burned_kcal), "kcal"],
          [t("Su"), nf(s.water_ml), "ml"],
        ].map(([l, v, u]) => (
          <div key={l}>
            <p className="text-[11px] text-muted">{l}</p>
            <p className="text-base font-semibold">{v}</p>
            <p className="text-[10px] text-muted">{u}</p>
          </div>
        ))}
        <div className="col-span-4 mt-1 flex justify-center gap-4 border-t border-border pt-2 text-xs text-muted">
          <span>
            {t("Protein")} <b className="text-protein">{nf(s.intake.protein_g)} g</b>
          </span>
          <span>
            {t("Karb.")} <b className="text-carbs">{nf(s.intake.carbs_g)} g</b>
          </span>
          <span>
            {t("Yağ")} <b className="text-fat">{nf(s.intake.fat_g)} g</b>
          </span>
          <span>
            {t("Şeker")} <b className="text-text">{nf(s.intake.sugar_g)} g</b>
          </span>
        </div>
      </Card>

      {day.loading && !day.data ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="space-y-3">
          {MEALS.map((m) => {
            const list = data.food.filter((f) => f.meal === m);
            const kcal = list.reduce((x, f) => x + f.kcal, 0);
            const addHref = m === "drink" ? `/drinks?date=${date}` : `/add?meal=${m}&date=${date}`;
            return (
              <Card key={m} className="p-0">
                <div className="flex items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <h2 className="font-semibold">{label(MEAL_LABELS, m, lang)}</h2>
                    <p className="text-xs text-muted">{list.length ? `${nf(kcal)} kcal` : t("Kayıt yok")}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {list.length > 0 && (
                      <button
                        type="button"
                        aria-label={t("Öğünü başka güne kopyala")}
                        onClick={() => {
                          setCopyDate(date === toDateKey() ? addDays(date, -1) : toDateKey());
                          setCopying({ entries: list, title: label(MEAL_LABELS, m, lang) });
                        }}
                        className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface-2"
                      >
                        <Copy size={16} />
                      </button>
                    )}
                    <Link href={addHref} aria-label={`${label(MEAL_LABELS, m, lang)}: ${t("Kayıt ekle")}`} className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-primary">
                      <Plus size={18} />
                    </Link>
                  </div>
                </div>
                {list.length > 0 && (
                  <ul className="divide-y divide-border border-t border-border">
                    {list.map((e) => (
                      <li key={e.id}>
                        <button type="button" onClick={() => setEditing(e)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left">
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                              {e.photo_path && <Camera size={13} className="shrink-0 text-muted" />}
                              <span className="truncate">{e.name}</span>
                            </p>
                            <p className="truncate text-xs text-muted">
                              {timeOf(e.consumed_at)}
                              {e.volume_ml ? ` · ${nf(e.volume_ml)} ml` : e.grams ? ` · ${nf(e.grams)} g` : ""} · P {nf(e.protein_g)} · K {nf(e.carbs_g)} · Y {nf(e.fat_g)}
                              {e.alcohol_g > 0 ? ` · ${t("alkol")} ${nf(e.alcohol_g, 1)} g` : ""}
                            </p>
                            <div className="mt-1">
                              <SourceBadges item={e} />
                            </div>
                          </div>
                          <span className="shrink-0 text-sm font-semibold">
                            {nf(e.kcal)} <span className="text-xs font-normal text-muted">kcal</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}

          <div className="grid gap-3 sm:grid-cols-3">
            <Link href={`/water?date=${date}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5">
              <Droplets size={20} className="text-water" />
              <div>
                <p className="text-sm font-medium">{t("Su")}</p>
                <p className="text-xs text-muted">
                  {nf(s.water_ml)} / {nf(profile?.water_target_ml ?? 0)} ml
                </p>
              </div>
            </Link>
            <Link href={`/activity?date=${date}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5">
              <ActivityIcon size={20} className="text-burn" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{t("Aktivite")}</p>
                <p className="truncate text-xs text-muted">
                  {data.activities.length ? data.activities.map((a) => a.name || label(ACTIVITY_LABELS, a.type, lang)).join(", ") : t("Kayıt yok")} · {nf(s.steps)} {t("adım")}
                </p>
              </div>
              {s.burned_kcal > 0 && (
                <span className="ml-auto flex shrink-0 items-center gap-0.5 text-xs font-semibold text-burn">
                  <Flame size={12} />
                  {nf(s.burned_kcal)}
                </span>
              )}
            </Link>
            <Link href={`/wellbeing?date=${date}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5">
              <Moon size={20} className="text-fat" />
              <div>
                <p className="text-sm font-medium">{t("Uyku ve durum")}</p>
                <p className="text-xs text-muted">{daily?.sleep_hours != null ? t("{n} saat uyku", { n: nf(daily.sleep_hours, 1) }) : t("Kayıt yok")}</p>
              </div>
            </Link>
          </div>
        </div>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={t("Kaydı düzenle")}>
        {editing && (
          <div className="space-y-3">
            {editing.photo_path && <Photo path={editing.photo_path} />}
            <ItemFields item={asItem(editing)} onChange={(next) => setEditing({ ...editing, ...next })} defaultOpen />
            <Field label={t("Öğün")}>
              <div className="flex flex-wrap gap-2">
                {MEALS.map((m) => (
                  <Chip key={m} active={editing.meal === m} onClick={() => setEditing({ ...editing, meal: m as Meal })}>
                    {label(MEAL_LABELS, m, lang)}
                  </Chip>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("Tarih")}>
                <Input type="date" value={editing.entry_date} max={toDateKey()} onChange={(e) => e.target.value && setEditing({ ...editing, entry_date: e.target.value, consumed_at: timestampFor(e.target.value, timeOf(editing.consumed_at)) })} />
              </Field>
              <Field label={t("Saat")}>
                <Input type="time" value={timeOf(editing.consumed_at)} onChange={(e) => setEditing({ ...editing, consumed_at: timestampFor(editing.entry_date, e.target.value) })} />
              </Field>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" onClick={() => remove(editing)} aria-label={t("Sil")}>
                <Trash2 size={16} />
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setCopyDate(editing.entry_date === toDateKey() ? addDays(editing.entry_date, -1) : toDateKey());
                  setCopying({ entries: [editing], title: editing.name });
                  setEditing(null);
                }}
              >
                <Copy size={16} />
                {t("Kopyala")}
              </Button>
              <Button className="flex-1" loading={busy} onClick={saveEdit}>
                {t("Kaydet")}
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet open={!!copying} onClose={() => setCopying(null)} title={t("Başka güne kopyala")}>
        {copying && (
          <div className="space-y-3">
            <p className="text-sm text-muted">{t("“{name}” ({n} kayıt) seçtiğiniz güne kopyalanır.", { name: copying.title, n: copying.entries.length })}</p>
            <Field label={t("Hedef tarih")}>
              <Input type="date" value={copyDate} max={toDateKey()} onChange={(e) => e.target.value && setCopyDate(e.target.value)} />
            </Field>
            <div className="flex gap-2">
              <Chip onClick={() => setCopyDate(toDateKey())} active={copyDate === toDateKey()}>
                {t("Bugün")}
              </Chip>
              <Chip onClick={() => setCopyDate(addDays(toDateKey(), -1))} active={copyDate === addDays(toDateKey(), -1)}>
                {t("Dün")}
              </Chip>
            </div>
            <Button className="w-full" size="lg" loading={busy} onClick={doCopy}>
              {t("Kopyala")}
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

export default function DiaryPage() {
  return (
    <Suspense>
      <DiaryInner />
    </Suspense>
  );
}
