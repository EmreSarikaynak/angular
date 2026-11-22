"use client";
import { use, useEffect, useState } from "react";
import { LineSeries, BarSeries } from "@/components/charts";
import { Logo } from "@/components/logo";
import { Card, Stat } from "@/components/ui";
import { formatShort } from "@/lib/dates";
import { translate, numberFmt } from "@/lib/i18n";
import { ACTIVITY_LABELS, ACTIVITY_LEVEL_LABELS, ALLERGY_OPTIONS, DIET_OPTIONS, GOAL_LABELS, MEAL_LABELS, label } from "@/lib/i18n/labels";
import type { Lang } from "@/lib/types";

interface Shared {
  first_name: string | null;
  label: string | null;
  from: string;
  to: string;
  expires_at: string;
  language: Lang;
  sections: { meals: boolean; body: boolean; wellbeing: boolean };
  profile: { age: number | null; sex: string | null; height_cm: number | null; goal: string | null; activity_level: string | null; allergies: string[]; diet_preferences: string[]; targets: { kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; water_ml: number | null; steps: number | null }; start_weight_kg?: number | null; weight_kg?: number | null; target_weight_kg?: number | null };
  averages: { kcal: number; protein_g: number; carbs_g: number; fat_g: number; sugar_g: number; fiber_g: number; salt_g: number } | null;
  adherence: { loggedDays: number; totalDays: number; calories: number | null; protein: number | null; water: number | null; steps: number | null };
  activity: { sessions: number; minutes: number; kcal: number; byType: { type: string; sessions: number; minutes: number }[] };
  days: { date: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; water_ml: number; burned_kcal: number; steps: number; sleep_hours?: number | null; mood?: number | null; energy?: number | null; stress?: number | null }[];
  top_foods: { name: string; count: number; kcal: number }[];
  meals: { date: string; meal: string; name: string; grams: number | null; kcal: number; protein_g: number }[] | null;
  weights: { date: string; weight_kg: number; bmi: number | null; waist_cm: number | null; body_fat_pct: number | null }[] | null;
}

/** Diyetisyen / koç için salt okunur rapor. Oturum gerektirmez; erişim bağlantıdaki gizli belirteçle sağlanır. */
export default function SharedReportPage({ params }: PageProps<"/share/[token]">) {
  const { token } = use(params);
  const [data, setData] = useState<Shared | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "gone">("loading");

  useEffect(() => {
    fetch(`/api/share/${token}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) return setState("gone");
        setData((await r.json()) as Shared);
        setState("ok");
      })
      .catch(() => setState("gone"));
  }, [token]);

  const lang: Lang = data?.language ?? "tr";
  const t = (s: string, v?: Record<string, string | number>) => translate(lang, s, v);
  const nf = (n: number, d = 0) => numberFmt(lang, n, d);
  const pct = (n: number | null) => (n == null ? "–" : `%${n}`);

  if (state === "loading") return <div className="grid min-h-dvh place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" /></div>;
  if (state === "gone" || !data) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-md place-items-center p-6 text-center">
        <div>
          <Logo size={56} className="mx-auto mb-4" />
          <h1 className="text-lg font-bold">Bağlantı geçersiz · Link not valid</h1>
          <p className="mt-2 text-sm text-muted">Bu paylaşım bağlantısının süresi dolmuş ya da sahibi tarafından iptal edilmiş. · This shared link has expired or was revoked by its owner.</p>
        </div>
      </main>
    );
  }
  const p = data.profile;
  const chips = [...p.allergies.map((a) => label(ALLERGY_OPTIONS, a, lang)), ...p.diet_preferences.map((d) => label(DIET_OPTIONS, d, lang))];

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <header className="flex items-center gap-3">
        <Logo size={44} />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight">{t("{name} · paylaşılan rapor", { name: data.first_name ?? "BKN" })}</h1>
          <p className="truncate text-sm text-muted">
            {formatShort(data.from, lang)} – {formatShort(data.to, lang)} · {t("Salt okunur")} · {t("Bitiş")}: {new Date(data.expires_at).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR")}
          </p>
        </div>
      </header>

      <Card>
        <h2 className="mb-3 font-semibold">{t("Profil ve hedefler")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t("Yaş")} value={p.age != null ? String(p.age) : "–"} />
          <Stat label={t("Boy (cm)")} value={p.height_cm != null ? nf(p.height_cm) : "–"} />
          <Stat label={t("Hedef")} value={label(GOAL_LABELS, p.goal, lang) || "–"} />
          <Stat label={t("Kalori (kcal)")} value={p.targets.kcal != null ? nf(p.targets.kcal) : "–"} />
          <Stat label={t("Protein (g)")} value={String(p.targets.protein_g ?? "–")} />
          <Stat label={t("Karbonhidrat (g)")} value={String(p.targets.carbs_g ?? "–")} />
          <Stat label={t("Yağ (g)")} value={String(p.targets.fat_g ?? "–")} />
          <Stat label={t("Su (ml)")} value={p.targets.water_ml != null ? nf(p.targets.water_ml) : "–"} />
        </div>
        {p.activity_level && <p className="mt-3 text-xs text-muted">{label(ACTIVITY_LEVEL_LABELS, p.activity_level, lang)}</p>}
        {chips.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span key={c} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">
                {c}
              </span>
            ))}
          </p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">{t("Günlük ortalama")}</h2>
          {data.averages ? (
            <div className="grid grid-cols-3 gap-3">
              <Stat label={t("Kalori")} value={nf(data.averages.kcal)} unit="kcal" />
              <Stat label={t("Protein")} value={nf(data.averages.protein_g)} unit="g" />
              <Stat label={t("Karbonhidrat")} value={nf(data.averages.carbs_g)} unit="g" />
              <Stat label={t("Yağ")} value={nf(data.averages.fat_g)} unit="g" />
              <Stat label={t("Şeker")} value={nf(data.averages.sugar_g)} unit="g" />
              <Stat label={t("Lif")} value={nf(data.averages.fiber_g)} unit="g" />
            </div>
          ) : (
            <p className="text-sm text-muted">{t("Bu dönem için kayıt yok")}</p>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">{t("Hedeflere uyum")}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label={t("Kayıt girilen gün")} value={`${data.adherence.loggedDays}/${data.adherence.totalDays}`} />
            <Stat label={t("Kalori")} value={pct(data.adherence.calories)} />
            <Stat label={t("Protein")} value={pct(data.adherence.protein)} />
            <Stat label={t("Su")} value={pct(data.adherence.water)} />
            <Stat label={t("Adım")} value={pct(data.adherence.steps)} />
            <Stat label={t("Aktivite")} value={`${data.activity.sessions}× · ${nf(data.activity.minutes)} ${t("dk")}`} />
          </div>
          {data.activity.byType.length > 0 && <p className="mt-2 text-xs text-muted">{data.activity.byType.map((a) => `${label(ACTIVITY_LABELS, a.type, lang)} ${a.sessions}×`).join(" · ")}</p>}
        </Card>
      </div>

      {data.days.length > 0 && (
        <Card>
          <h2 className="mb-2 font-semibold">{t("Kalori tüketimi")}</h2>
          <BarSeries data={data.days.map((d) => ({ label: formatShort(d.date, lang), value: d.kcal }))} unit="kcal" target={p.targets.kcal} />
        </Card>
      )}

      {data.weights && data.weights.length > 0 && (
        <Card>
          <h2 className="mb-2 font-semibold">{t("Kilo değişimi")}</h2>
          <p className="mb-2 text-xs text-muted">
            {t("Başlangıç")} {p.start_weight_kg ?? "–"} kg · {t("Mevcut")} {p.weight_kg ?? "–"} kg · {t("Hedef")} {p.target_weight_kg ?? "–"} kg
          </p>
          {data.weights.length >= 2 ? <LineSeries data={data.weights.map((w) => ({ label: formatShort(w.date, lang), value: w.weight_kg }))} unit="kg" target={p.target_weight_kg} /> : <p className="text-sm">{nf(data.weights[0].weight_kg, 1)} kg · {formatShort(data.weights[0].date, lang)}</p>}
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <h2 className="px-4 py-3 font-semibold">{t("Günlük döküm")}</h2>
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="border-y border-border text-muted">
            <tr>
              {[t("Tarih"), "kcal", "P", "K", "Y", t("Su (ml)"), t("Yakılan"), t("Adım"), ...(data.sections.wellbeing ? [t("Uyku (saat)"), t("Ruh hali"), t("Enerji"), t("Stres")] : [])].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.days.map((d) => (
              <tr key={d.date}>
                <td className="px-3 py-2">{formatShort(d.date, lang)}</td>
                <td className="px-3 py-2 font-medium">{nf(d.kcal)}</td>
                <td className="px-3 py-2">{d.protein_g}</td>
                <td className="px-3 py-2">{d.carbs_g}</td>
                <td className="px-3 py-2">{d.fat_g}</td>
                <td className="px-3 py-2">{nf(d.water_ml)}</td>
                <td className="px-3 py-2">{nf(d.burned_kcal)}</td>
                <td className="px-3 py-2">{d.steps ? nf(d.steps) : "–"}</td>
                {data.sections.wellbeing && [d.sleep_hours, d.mood, d.energy, d.stress].map((v, i) => <td key={i} className="px-3 py-2">{v ?? "–"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {data.top_foods.length > 0 && (
        <Card>
          <h2 className="mb-2 font-semibold">{t("En sık tüketilen yiyecekler")}</h2>
          <ul className="divide-y divide-border text-sm">
            {data.top_foods.map((f) => (
              <li key={f.name} className="flex justify-between gap-3 py-1.5">
                <span className="min-w-0 truncate">{f.name}</span>
                <span className="shrink-0 text-muted">
                  {f.count}× · {nf(f.kcal)} kcal
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data.meals && data.meals.length > 0 && (
        <Card className="p-0">
          <h2 className="px-4 py-3 font-semibold">{t("Öğün ayrıntıları")}</h2>
          <ul className="divide-y divide-border border-t border-border text-sm">
            {data.meals.map((m, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="min-w-0">
                  <span className="block truncate">{m.name}</span>
                  <span className="block text-xs text-muted">
                    {formatShort(m.date, lang)} · {label(MEAL_LABELS, m.meal, lang)}
                    {m.grams ? ` · ${nf(m.grams)} g` : ""}
                  </span>
                </span>
                <span className="shrink-0 font-medium">{nf(m.kcal)} kcal</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className="pb-6 text-center text-xs text-muted">{t("Bu rapor kullanıcının kendi kayıtlarına ve tahminlere dayanır. Kullanıcı bu bağlantıyı dilediği zaman iptal edebilir.")} · BKN</p>
    </main>
  );
}
