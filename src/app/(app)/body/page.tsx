"use client";
import { useState } from "react";
import { Ruler, Trash2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { LineSeries } from "@/components/charts";
import { Button, Card, Chip, Empty, Field, Input, NumberInput, PageHeader, Skeleton, Stat } from "@/components/ui";
import { useBody, useCycleLogs } from "@/lib/data/hooks";
import { cycleAvailable, cycleInfo } from "@/lib/bkn/cycle";
import { deleteRow, upsertRow, uuid } from "@/lib/data/store";
import { formatShort, toDateKey } from "@/lib/dates";
import { numberFmt } from "@/lib/i18n";
import { bmi, bmiClass, goalProgress } from "@/lib/nutrition/calc";
import type { BodyMeasurement } from "@/lib/types";

type Metric = "weight_kg" | "waist_cm" | "hip_cm" | "chest_cm" | "body_fat_pct" | "bmi";

export default function BodyPage() {
  const { t, lang, profile, saveProfile, toast } = useApp();
  const body = useBody();
  const cycleLogs = useCycleLogs().data;
  const cycle = cycleAvailable(profile?.sex) ? cycleInfo(cycleLogs ?? [], toDateKey()) : null;
  const [date, setDate] = useState(toDateKey());
  const [weight, setWeight] = useState<number | null>(null);
  const [waist, setWaist] = useState<number | null>(null);
  const [hip, setHip] = useState<number | null>(null);
  const [chest, setChest] = useState<number | null>(null);
  const [fat, setFat] = useState<number | null>(null);
  const [metric, setMetric] = useState<Metric>("weight_kg");
  const [busy, setBusy] = useState(false);

  const rows = body.data ?? [];
  const nf = (n: number, d = 1) => numberFmt(lang, n, d);
  const weights = rows.filter((r) => r.weight_kg != null);
  const current = weights.at(-1)?.weight_kg ?? profile?.weight_kg ?? null;
  const start = profile?.start_weight_kg ?? weights[0]?.weight_kg ?? null;
  const target = profile?.target_weight_kg ?? null;
  const change = current != null && start != null ? current - start : null;
  const currentBmi = current != null && profile?.height_cm ? bmi(current, profile.height_cm) : null;
  const progress = goalProgress(start, current, target);
  const formBmi = weight && profile?.height_cm ? bmi(weight, profile.height_cm) : null;

  const METRICS: { key: Metric; label: string; unit: string }[] = [
    { key: "weight_kg", label: t("Kilo"), unit: "kg" },
    { key: "bmi", label: t("VKİ"), unit: "" },
    { key: "waist_cm", label: t("Bel"), unit: "cm" },
    { key: "hip_cm", label: t("Kalça"), unit: "cm" },
    { key: "chest_cm", label: t("Göğüs"), unit: "cm" },
    { key: "body_fat_pct", label: t("Yağ oranı"), unit: "%" },
  ];
  const active = METRICS.find((m) => m.key === metric)!;
  const series = rows.filter((r) => r[metric] != null).map((r) => ({ label: formatShort(r.entry_date, lang), value: r[metric] as number }));
  const bmiText: Record<string, string> = { under: t("Zayıf"), normal: t("Normal"), over: t("Fazla kilolu"), obese: t("Obez") };

  async function save() {
    if ([weight, waist, hip, chest, fat].every((v) => v == null)) return toast(t("En az bir ölçüm girin."), "error");
    if (weight != null && (weight < 30 || weight > 300)) return toast(t("Kilo 30–300 kg arasında olmalı."), "error");
    setBusy(true);
    try {
      const existing = rows.find((r) => r.entry_date === date);
      const row: BodyMeasurement = {
        id: existing?.id ?? uuid(),
        entry_date: date,
        weight_kg: weight ?? existing?.weight_kg ?? null,
        waist_cm: waist ?? existing?.waist_cm ?? null,
        hip_cm: hip ?? existing?.hip_cm ?? null,
        chest_cm: chest ?? existing?.chest_cm ?? null,
        body_fat_pct: fat ?? existing?.body_fat_pct ?? null,
        bmi: null,
        note: null,
      };
      row.bmi = row.weight_kg && profile?.height_cm ? bmi(row.weight_kg, profile.height_cm) : null;
      const { queued } = await upsertRow("body_measurements", row);
      // En güncel kilo profilde tutulur (aktivite kalorisi ve hedef ilerlemesi için).
      const latest = [...weights.filter((w) => w.entry_date !== date), ...(row.weight_kg ? [row] : [])].sort((a, b) => a.entry_date.localeCompare(b.entry_date)).at(-1);
      if (latest?.weight_kg && latest.weight_kg !== profile?.weight_kg) await saveProfile({ weight_kg: latest.weight_kg }).catch(() => {});
      toast(queued ? t("Cihaza kaydedildi; bağlantı gelince gönderilecek.") : t("Ölçüm kaydedildi."), queued ? "info" : "ok");
      setWeight(null);
      setWaist(null);
      setHip(null);
      setChest(null);
      setFat(null);
    } catch {
      toast(t("Kaydedilemedi. Değerleri kontrol edip tekrar deneyin."), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title={t("Kilo ve vücut ölçümleri")} />
      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t("Başlangıç")} value={start != null ? nf(start) : "–"} unit="kg" />
          <Stat label={t("Mevcut")} value={current != null ? nf(current) : "–"} unit="kg" />
          <Stat label={t("Hedef")} value={target != null ? nf(target) : "–"} unit="kg" />
          <Stat label={t("Toplam değişim")} value={change != null ? `${change > 0 ? "+" : ""}${nf(change)}` : "–"} unit="kg" color={change != null && change !== 0 ? "var(--primary)" : undefined} />
        </div>
        {progress != null && (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted">{t("Hedefe ilerleme: %{n}", { n: progress })}</p>
          </div>
        )}
        {currentBmi != null && (
          <p className="mt-2 text-sm">
            {t("VKİ")}: <b>{nf(currentBmi)}</b> <span className="text-muted">· {bmiText[bmiClass(currentBmi)]}</span>
          </p>
        )}
      </Card>

      {cycle && (cycle.premenstrual || cycle.ongoing) && (
        <p className="mb-4 rounded-xl bg-protein/10 px-3 py-2.5 text-sm">
          {t("Döngünüzün {n}. günündesiniz. Bu dönemde su tutulumu tartıda 1–2 kg'a kadar geçici artış gösterebilir; eğilimi haftalık ortalamayla değerlendirin.", { n: cycle.day })}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <p className="text-sm font-semibold">{t("Yeni ölçüm")}</p>
          <Field label={t("Tarih")}>
            <Input type="date" value={date} max={toDateKey()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Kilo (kg)")} hint={formBmi ? `${t("VKİ")}: ${nf(formBmi)}` : undefined}>
              <NumberInput value={weight} onChange={setWeight} min={30} max={300} step="0.1" />
            </Field>
            <Field label={t("Vücut yağ oranı (%)")}>
              <NumberInput value={fat} onChange={setFat} min={1} max={75} step="0.1" />
            </Field>
            <Field label={t("Bel çevresi (cm)")}>
              <NumberInput value={waist} onChange={setWaist} min={20} max={300} step="0.1" />
            </Field>
            <Field label={t("Kalça çevresi (cm)")}>
              <NumberInput value={hip} onChange={setHip} min={20} max={300} step="0.1" />
            </Field>
            <Field label={t("Göğüs çevresi (cm)")}>
              <NumberInput value={chest} onChange={setChest} min={20} max={300} step="0.1" />
            </Field>
          </div>
          <Button size="lg" className="w-full" loading={busy} onClick={save}>
            {t("Ölçümü kaydet")}
          </Button>
        </Card>

        <Card>
          <div className="mb-3 flex flex-wrap gap-2">
            {METRICS.map((m) => (
              <Chip key={m.key} active={metric === m.key} onClick={() => setMetric(m.key)}>
                {m.label}
              </Chip>
            ))}
          </div>
          {body.loading && !body.data ? (
            <Skeleton className="h-48" />
          ) : series.length < 2 ? (
            <Empty icon={<Ruler size={22} />} title={t("Grafik için en az iki ölçüm gerekli")} text={t("Düzenli ölçüm girdikçe değişim burada görünür.")} />
          ) : (
            <LineSeries data={series} unit={active.unit} target={metric === "weight_kg" ? target : null} />
          )}
        </Card>
      </div>

      <Card className="mt-4 p-0">
        <p className="px-4 py-3 text-sm font-semibold">{t("Ölçüm geçmişi")}</p>
        {rows.length === 0 ? (
          <Empty title={t("Henüz ölçüm yok")} />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {[...rows].reverse().map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{formatShort(r.entry_date, lang)}</p>
                  <p className="truncate text-xs text-muted">
                    {[
                      r.weight_kg != null && `${nf(r.weight_kg)} kg`,
                      r.bmi != null && `${t("VKİ")} ${nf(r.bmi)}`,
                      r.waist_cm != null && `${t("Bel")} ${nf(r.waist_cm)}`,
                      r.hip_cm != null && `${t("Kalça")} ${nf(r.hip_cm)}`,
                      r.chest_cm != null && `${t("Göğüs")} ${nf(r.chest_cm)}`,
                      r.body_fat_pct != null && `${t("Yağ oranı")} %${nf(r.body_fat_pct)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={t("Sil")}
                  onClick={() => confirm(t("Bu ölçüm silinsin mi?")) && deleteRow("body_measurements", r.id).catch(() => toast(t("Silinemedi."), "error"))}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:text-danger"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
