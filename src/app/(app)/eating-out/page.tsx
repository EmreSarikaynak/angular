"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, Camera, Image as ImageIcon, Plus, ThumbsUp, UtensilsCrossed } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button, Card, PageHeader, Segmented } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useDay } from "@/lib/data/hooks";
import { upsertRow, uuid } from "@/lib/data/store";
import { summarizeDay } from "@/lib/day";
import { defaultMeal, timestampFor, toDateKey } from "@/lib/dates";
import { errorText } from "@/lib/errors";
import { compressImage } from "@/lib/image";

interface Dish {
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fit: "good" | "ok" | "avoid";
  reason: string;
  tip?: string | null;
  allergen_warning: boolean;
}

export default function EatingOutPage() {
  const { t, lang, profile, toast, online, config, refreshConfig } = useApp();
  const today = toDateKey();
  const day = useDay(today);
  const [dishes, setDishes] = useState<Dish[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"good" | "all">("good");

  const s = useMemo(() => summarizeDay(today, day.data ?? { food: [], water: [], activities: [], daily: [], rings: [] }, profile), [day.data, today, profile]);
  const remainingKcal = Math.max(0, Math.round(s.remaining_kcal));
  const remainingProtein = Math.max(0, Math.round((profile?.protein_target_g ?? 0) - s.intake.protein_g));
  const aiReady = online && config?.ai_available !== false;

  async function scan(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      // Menü yazıları okunabilsin diye yemek fotoğrafından daha yüksek çözünürlük.
      const image = await compressImage(file, 1800, 0.85);
      const res = await api<{ result: { is_menu: boolean; dishes: Dish[] } }>("/api/ai/menu", { body: { image: { data: image.base64, mimeType: image.mimeType }, remaining_kcal: remainingKcal, remaining_protein_g: remainingProtein, lang } });
      void refreshConfig();
      if (!res.result.is_menu || res.result.dishes.length === 0) {
        setDishes(null);
        return setError(t("Bu görselde menü bulunamadı. Yazıların okunaklı olduğu bir fotoğraf deneyin."));
      }
      const order = { good: 0, ok: 1, avoid: 2 };
      setDishes([...res.result.dishes].sort((a, b) => order[a.fit] - order[b.fit] || b.protein_g - a.protein_g));
      setFilter(res.result.dishes.some((d) => d.fit === "good") ? "good" : "all");
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : ((e as Error).message ?? ""), t));
    } finally {
      setBusy(false);
    }
  }

  async function add(d: Dish) {
    try {
      await upsertRow("food_entries", {
        id: uuid(), entry_date: today, consumed_at: timestampFor(today), meal: defaultMeal(), name: d.name.slice(0, 200), quantity: 1, unit: t("porsiyon"), grams: null,
        kcal: d.kcal, protein_g: d.protein_g, carbs_g: d.carbs_g, fat_g: d.fat_g, sugar_g: 0, fiber_g: 0, salt_g: 0, alcohol_g: 0,
        source: "manual", data_source: "ai", is_estimated: true, confidence: 0.5, photo_path: null, group_id: null, group_name: null, drink_type: null, volume_ml: null, abv: null, note: null,
      });
      toast(t("Günlüğe eklendi."));
    } catch {
      toast(t("Kaydedilemedi."), "error");
    }
  }

  const badge: Record<Dish["fit"], [string, string]> = { good: [t("Önerilir"), "bg-primary-soft text-primary"], ok: [t("Olabilir"), "bg-surface-2 text-muted"], avoid: [t("Bugün için ağır"), "bg-warn/15 text-warn"] };
  const shown = (dishes ?? []).filter((d) => filter === "all" || d.fit === "good");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("Dışarıda yemek")} subtitle={t("Menünün fotoğrafını çekin, hedefinize uygun seçenekleri görün")} />
      <input id="bkn-menu-camera" type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void scan(e.target.files?.[0]); e.target.value = ""; }} />
      <input id="bkn-menu-gallery" type="file" accept="image/*" hidden onChange={(e) => { void scan(e.target.files?.[0]); e.target.value = ""; }} />

      <Card className="space-y-3">
        <p className="text-sm">
          {t("Bugün kalan")}: <b>{remainingKcal} kcal</b> · {t("protein")} <b>{remainingProtein} g</b>
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" loading={busy} disabled={!aiReady} onClick={() => document.getElementById("bkn-menu-camera")?.click()}>
            <Camera size={18} />
            {t("Menüyü çek")}
          </Button>
          <Button size="lg" variant="secondary" disabled={!aiReady || busy} onClick={() => document.getElementById("bkn-menu-gallery")?.click()}>
            <ImageIcon size={18} />
            {t("Galeriden seç")}
          </Button>
        </div>
        {busy && <p className="text-center text-xs text-muted">{t("Menü okunuyor; bu işlem yarım dakika kadar sürebilir.")}</p>}
        {!aiReady && <p className="text-xs text-warn">{t("Menü okumak için bağlantı ve yapay zekâ servisi gerekir.")}</p>}
        {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      </Card>

      {dishes && (
        <>
          <Segmented className="my-3" value={filter} onChange={setFilter} options={[{ value: "good", label: `${t("Önerilenler")} (${dishes.filter((d) => d.fit === "good").length})` }, { value: "all", label: `${t("Tüm menü")} (${dishes.length})` }]} />
          {shown.length === 0 && <p className="rounded-xl bg-surface-2 px-3 py-3 text-sm text-muted">{t("Kalan hedefinize tam uyan bir seçenek bulunamadı. Tüm menüde “Olabilir” işaretli seçeneklere ve ipuçlarına bakın.")}</p>}
          <div className="space-y-3">
            {shown.map((d, i) => (
              <Card key={`${d.name}-${i}`} className="p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{d.name}</p>
                  <span className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge[d.fit][1]}`}>
                    {d.fit === "good" && <ThumbsUp size={11} />}
                    {badge[d.fit][0]}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  ~{d.kcal} kcal · P {d.protein_g} · K {d.carbs_g} · Y {d.fat_g} g
                </p>
                {d.allergen_warning && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger">
                    <AlertTriangle size={13} />
                    {t("Alerjeniniz içerebilir; sipariş öncesi restorana sorun.")}
                  </p>
                )}
                {d.reason && <p className="mt-1.5 text-sm">{d.reason}</p>}
                {d.tip && <p className="mt-1 text-xs text-primary">{t("İpucu")}: {d.tip}</p>}
                <Button size="sm" variant="secondary" className="mt-2.5" onClick={() => add(d)}>
                  <Plus size={15} />
                  {t("Bunu yedim, günlüğe ekle")}
                </Button>
              </Card>
            ))}
          </div>
          <p className="mt-3 flex gap-2 text-xs text-muted">
            <UtensilsCrossed size={14} className="mt-0.5 shrink-0" />
            {t("Değerler menüdeki yemek adından yapılan tahminlerdir; restoranın porsiyonu ve tarifi farklı olabilir. Alerjiniz varsa içerik bilgisini mutlaka restorandan doğrulayın.")}
          </p>
        </>
      )}
    </div>
  );
}
