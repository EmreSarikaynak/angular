"use client";
import { useEffect, useState } from "react";
import { Check, Crown, RotateCcw, Sparkles } from "lucide-react";
import { useApp } from "./app-provider";
import { Button, Card, Field, NumberInput, Segmented, Skeleton } from "./ui";
import type { FeatureConfig, Limit, Tier } from "@/lib/features";

export interface PlansData {
  catalog: { key: string; label: string; description: string; defaults: FeatureConfig; config: FeatureConfig; usage: { today: number; d30: number } }[];
  app_features: { key: string; label: string; note?: string }[];
  limits: { default_daily_ai_limit: number; premium_daily_ai_limit: number };
  counts: { total_users: number; subscribers: number; comped: number };
}

type Draft = Record<string, FeatureConfig>;

/** Yönetim paneli › Planlar: hangi özellik hangi planda, plan başına günlük limitler. */
export function AdminPlans({ data, onSave, saving }: { data: PlansData | null; onSave: (config: Draft) => void; saving: boolean }) {
  const { t, lang } = useApp();
  const [draft, setDraft] = useState<Draft>({});
  useEffect(() => {
    if (data) setDraft(Object.fromEntries(data.catalog.map((f) => [f.key, { ...f.config }])));
  }, [data]);
  if (!data) return <Skeleton className="h-64" />;

  const set = (key: string, patch: Partial<FeatureConfig>) => setDraft((d) => ({ ...d, [key]: { ...d[key], ...patch } }));
  const same = (a: FeatureConfig, b: FeatureConfig) => a.tier === b.tier && a.free === b.free && a.premium === b.premium;
  const dirty = data.catalog.some((f) => draft[f.key] && !same(draft[f.key], f.config));
  const lim = (v: Limit) => (v == null ? t("Sınırsız") : v === 0 ? t("Kapalı") : String(v));
  const num = (n: number) => n.toLocaleString(lang === "en" ? "en-GB" : "tr-TR");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          [t("Toplam kullanıcı"), data.counts.total_users],
          [t("Aktif abone"), data.counts.subscribers],
          [t("Elle Premium"), data.counts.comped],
        ].map(([label, v]) => (
          <Card key={label as string} className="p-3">
            <p className="text-[11px] text-muted">{label}</p>
            <p className="text-xl font-bold">{num(v as number)}</p>
          </Card>
        ))}
      </div>

      <Card className="space-y-1 text-sm">
        <p className="font-semibold">{t("Genel günlük yapay zekâ limiti")}</p>
        <p className="text-muted">
          {t("Ücretsiz")}: <b className="text-text">{num(data.limits.default_daily_ai_limit)}</b> · Premium: <b className="text-text">{num(data.limits.premium_daily_ai_limit)}</b> {t("çağrı / gün (tüm özelliklerin toplamı). Ayarlar sekmesinden değiştirilir.")}
        </p>
        <p className="text-xs text-muted">{t("Aşağıdaki özellik limitleri bu genel limitin ÜSTÜNE uygulanır: ikisinden biri dolunca kullanım durur.")}</p>
      </Card>

      <h2 className="flex items-center gap-2 font-semibold">
        <Sparkles size={16} className="text-primary" />
        {t("Yapay zekâ özellikleri")}
      </h2>
      {data.catalog.map((f) => {
        const c = draft[f.key] ?? f.config;
        const changed = !same(c, f.config);
        const isDefault = same(c, f.defaults);
        return (
          <Card key={f.key} className={`space-y-3 ${changed ? "border-primary" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{t(f.label)}</p>
                <p className="text-xs text-muted">{t(f.description)}</p>
              </div>
              <div className="shrink-0 text-right text-[11px] text-muted">
                <p>
                  {t("bugün")}: <b className="text-text">{num(f.usage.today)}</b>
                </p>
                <p>
                  30 {t("gün")}: <b className="text-text">{num(f.usage.d30)}</b>
                </p>
              </div>
            </div>
            <Segmented<Tier>
              value={c.tier}
              onChange={(v) => set(f.key, { tier: v })}
              options={[
                { value: "free", label: t("Herkese açık") },
                { value: "premium", label: t("Premium'a özel") },
              ]}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("Ücretsiz üye limiti / gün")} hint={c.tier === "premium" ? t("Premium'a özel: ücretsiz üye kullanamaz.") : t("Boş = sınırsız, 0 = kapalı")}>
                <NumberInput value={c.free} min={0} max={100000} disabled={c.tier === "premium"} placeholder={t("Sınırsız")} onChange={(v) => set(f.key, { free: v == null ? null : Math.round(v) })} />
              </Field>
              <Field label={t("Premium limiti / gün")} hint={t("Boş = sınırsız, 0 = kapalı")}>
                <NumberInput value={c.premium} min={0} max={100000} placeholder={t("Sınırsız")} onChange={(v) => set(f.key, { premium: v == null ? null : Math.round(v) })} />
              </Field>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
              <span className="flex items-center gap-1">
                {c.tier === "premium" ? <Crown size={12} className="text-primary" /> : <Check size={12} className="text-primary" />}
                {c.tier === "premium" ? t("Yalnızca Premium") : `${t("Ücretsiz")}: ${lim(c.free)} · Premium: ${lim(c.premium)}`}
              </span>
              {!isDefault && (
                <button type="button" onClick={() => set(f.key, { ...f.defaults })} className="inline-flex items-center gap-1 font-medium text-primary">
                  <RotateCcw size={11} />
                  {t("Varsayılana dön")}
                </button>
              )}
            </div>
          </Card>
        );
      })}

      <div className="sticky bottom-20 z-30 lg:bottom-4">
        <Button size="lg" className="w-full shadow-lg" disabled={!dirty} loading={saving} onClick={() => onSave(draft)}>
          {t("Planları kaydet")}
        </Button>
      </div>

      <h2 className="font-semibold">{t("Diğer özellikler (herkese açık, sınırsız)")}</h2>
      <Card className="divide-y divide-border p-0">
        {data.app_features.map((f) => (
          <div key={f.key} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="min-w-0">
              {t(f.label)}
              {f.note && <span className="ml-1 text-xs text-muted">· {t(f.note)}</span>}
            </span>
            <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">{t("Herkese açık")}</span>
          </div>
        ))}
      </Card>
      <p className="text-xs text-muted">{t("Yapay zekâ kullanmayan özellikler plana göre kısıtlanmaz; yalnızca bilgi amaçlı listelenir.")}</p>
    </div>
  );
}
