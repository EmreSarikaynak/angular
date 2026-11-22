"use client";
import { Suspense, useEffect, useState } from "react";
import { Camera, CircleDot, Image as ImageIcon, Trash2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { ActivityRings, RingLegend } from "@/components/activity-rings";
import { DateNav, useDateParam } from "@/components/date-nav";
import { Button, Card, Empty, Field, NumberInput, PageHeader } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useRange } from "@/lib/data/hooks";
import { deleteRow, upsertRow, uuid } from "@/lib/data/store";
import { addDays, formatShort } from "@/lib/dates";
import { errorText } from "@/lib/errors";
import { compressImage } from "@/lib/image";
import type { HealthRing } from "@/lib/types";

type Form = Pick<HealthRing, "move_kcal" | "move_goal" | "exercise_min" | "exercise_goal" | "stand_hours" | "stand_goal" | "steps" | "distance_km">;
const EMPTY: Form = { move_kcal: null, move_goal: null, exercise_min: null, exercise_goal: null, stand_hours: null, stand_goal: null, steps: null, distance_km: null };

function RingsInner() {
  const { t, lang, toast, online, config, refreshConfig } = useApp();
  const [date, setDate] = useDateParam();
  const range = useRange(addDays(date, -6), date);
  const rings = range.data?.rings ?? [];
  const existing = rings.find((r) => r.entry_date === date);
  const [form, setForm] = useState<Form>(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [source, setSource] = useState<"manual" | "screenshot">("manual");
  const [busy, setBusy] = useState<"scan" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dirty) return;
    // Hedefler çoğunlukla değişmez: bugünün kaydı yoksa son kayıttaki hedefleri öner.
    const last = [...rings].reverse().find((r) => r.entry_date < date);
    setForm(existing ? { ...EMPTY, ...pick(existing) } : { ...EMPTY, move_goal: last?.move_goal ?? null, exercise_goal: last?.exercise_goal ?? 30, stand_goal: last?.stand_goal ?? 12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id, existing?.entry_date, date, dirty, rings.length]);

  const set = (patch: Partial<Form>) => {
    setDirty(true);
    setForm((f) => ({ ...f, ...patch }));
  };
  const labels = { move: t("Hareket"), exercise: t("Egzersiz"), stand: t("Ayakta"), min: t("dk"), hours: t("saat") };
  const aiReady = online && config?.ai_available !== false;
  const hasValues = form.move_kcal != null || form.exercise_min != null || form.stand_hours != null || form.steps != null;

  async function scan(file: File | undefined) {
    if (!file) return;
    setBusy("scan");
    setError(null);
    try {
      const image = await compressImage(file, 1600, 0.85);
      const res = await api<{ result: Form & { is_rings: boolean } }>("/api/ai/rings", { body: { image: { data: image.base64, mimeType: image.mimeType } } });
      void refreshConfig();
      const r = res.result;
      if (!r.is_rings || (r.move_kcal == null && r.exercise_min == null && r.stand_hours == null && r.steps == null)) {
        setError(t("Bu görselde sağlık halkası ya da aktivite özeti bulunamadı. Değerleri elle girebilirsiniz."));
        return;
      }
      // Okunamayan alanlar için formdaki mevcut değer (ör. hedefler) korunur.
      setForm((f) => ({
        move_kcal: r.move_kcal ?? f.move_kcal, move_goal: r.move_goal ?? f.move_goal, exercise_min: r.exercise_min ?? f.exercise_min, exercise_goal: r.exercise_goal ?? f.exercise_goal,
        stand_hours: r.stand_hours ?? f.stand_hours, stand_goal: r.stand_goal ?? f.stand_goal, steps: r.steps ?? f.steps, distance_km: r.distance_km ?? f.distance_km,
      }));
      setSource("screenshot");
      setDirty(true);
      toast(t("Değerler okundu. Kontrol edip kaydedin."), "info");
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : ((e as Error).message ?? ""), t));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!hasValues) return toast(t("En az bir değer girin."), "error");
    setBusy("save");
    try {
      const int = (v: number | null) => (v == null ? null : Math.round(v));
      const { queued } = await upsertRow(
        "health_rings",
        { id: existing?.id ?? uuid(), entry_date: date, move_kcal: int(form.move_kcal), move_goal: int(form.move_goal), exercise_min: int(form.exercise_min), exercise_goal: int(form.exercise_goal), stand_hours: int(form.stand_hours), stand_goal: int(form.stand_goal), steps: int(form.steps), distance_km: form.distance_km, source },
        "user_id,entry_date",
      );
      setDirty(false);
      toast(queued ? t("Cihaza kaydedildi; bağlantı gelince gönderilecek.") : t("Halkalar günlüğe kaydedildi."), queued ? "info" : "ok");
    } catch {
      toast(t("Kaydedilemedi. Değerleri kontrol edip tekrar deneyin."), "error");
    } finally {
      setBusy(null);
    }
  }

  const field = (name: string, key: keyof Form, max: number, step?: string) => (
    <Field label={name}>
      <NumberInput value={form[key]} onChange={(v) => set({ [key]: v })} min={0} max={max} step={step} className="h-10" />
    </Field>
  );

  return (
    <div>
      <PageHeader title={t("Sağlık halkaları")} subtitle={t("Akıllı saat veya telefonunuzdaki günlük aktivite özeti")} />
      <DateNav
        date={date}
        onChange={(d) => {
          setDirty(false);
          setError(null);
          setDate(d);
        }}
      />
      <input id="bkn-rings-camera" type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void scan(e.target.files?.[0]); e.target.value = ""; }} />
      <input id="bkn-rings-gallery" type="file" accept="image/*" hidden onChange={(e) => { void scan(e.target.files?.[0]); e.target.value = ""; }} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          {hasValues ? (
            <div className="flex items-center gap-5">
              <ActivityRings ring={form} size={160} label={t("Sağlık halkaları")} />
              <div className="min-w-0 flex-1">
                <RingLegend ring={form} labels={labels} />
                {(form.steps != null || form.distance_km != null) && (
                  <p className="mt-2 text-xs text-muted">
                    {form.steps != null ? `${new Intl.NumberFormat(lang === "en" ? "en-GB" : "tr-TR").format(form.steps)} ${t("adım")}` : ""}
                    {form.steps != null && form.distance_km != null ? " · " : ""}
                    {form.distance_km != null ? `${form.distance_km} km` : ""}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <Empty icon={<CircleDot size={22} />} title={t("Bu gün için halka kaydı yok")} text={t("Saatinizdeki ya da telefonunuzdaki aktivite ekranının görüntüsünü yükleyin; değerleri okuyup halkaları burada çizelim.")} />
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button loading={busy === "scan"} disabled={!aiReady} onClick={() => document.getElementById("bkn-rings-gallery")?.click()}>
              <ImageIcon size={16} />
              {t("Ekran görüntüsü yükle")}
            </Button>
            <Button variant="secondary" disabled={!aiReady || busy === "scan"} onClick={() => document.getElementById("bkn-rings-camera")?.click()}>
              <Camera size={16} />
              {t("Fotoğrafını çek")}
            </Button>
          </div>
          {!aiReady && <p className="mt-2 text-xs text-warn">{t("Görüntüden okuma için bağlantı ve yapay zekâ servisi gerekir; değerleri elle girebilirsiniz.")}</p>}
          {error && <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <p className="mt-3 text-xs text-muted">{t("Halka kaydı olan günlerde yakılan kalori için cihazınızın ölçtüğü değer kullanılır; aktivite ve adım tahminiyle toplanmaz.")}</p>
        </Card>

        <Card className="space-y-3">
          <p className="text-sm font-semibold">{t("Değerler")}</p>
          <div className="grid grid-cols-2 gap-3">
            {field(t("Hareket (kcal)"), "move_kcal", 20000)}
            {field(t("Hareket hedefi"), "move_goal", 20000)}
            {field(t("Egzersiz (dk)"), "exercise_min", 1440)}
            {field(t("Egzersiz hedefi"), "exercise_goal", 1440)}
            {field(t("Ayakta (saat)"), "stand_hours", 24)}
            {field(t("Ayakta hedefi"), "stand_goal", 24)}
            {field(t("Adım"), "steps", 200000)}
            {field(t("Mesafe (km)"), "distance_km", 500, "0.01")}
          </div>
          <div className="flex gap-2">
            {existing && (
              <Button
                variant="secondary"
                aria-label={t("Sil")}
                onClick={async () => {
                  if (!confirm(t("Bu günün halka kaydı silinsin mi?"))) return;
                  await deleteRow("health_rings", existing.id).catch(() => toast(t("Silinemedi."), "error"));
                  setDirty(false);
                }}
              >
                <Trash2 size={16} />
              </Button>
            )}
            <Button size="lg" className="flex-1" loading={busy === "save"} disabled={!dirty || !hasValues} onClick={save}>
              {t("Günlüğe kaydet")}
            </Button>
          </div>
        </Card>
      </div>

      {rings.length > 0 && (
        <Card className="mt-4">
          <p className="mb-3 text-sm font-semibold">{t("Son 7 gün")}</p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {rings.map((r) => (
              <button key={r.id} type="button" onClick={() => { setDirty(false); setDate(r.entry_date); }} className="flex shrink-0 flex-col items-center gap-1">
                <ActivityRings ring={r} size={56} label={formatShort(r.entry_date, lang)} />
                <span className={`text-[11px] ${r.entry_date === date ? "font-semibold text-primary" : "text-muted"}`}>{formatShort(r.entry_date, lang)}</span>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function pick(r: HealthRing): Form {
  return { move_kcal: r.move_kcal, move_goal: r.move_goal, exercise_min: r.exercise_min, exercise_goal: r.exercise_goal, stand_hours: r.stand_hours, stand_goal: r.stand_goal, steps: r.steps, distance_km: r.distance_km };
}

export default function RingsPage() {
  return (
    <Suspense>
      <RingsInner />
    </Suspense>
  );
}
