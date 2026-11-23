"use client";
import { useEffect, useState } from "react";
import { Timer, Trash2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button, Card, Chip, Empty, Field, Input, PageHeader, Ring, Stat } from "@/components/ui";
import { FASTING_PRESETS, elapsedHours, fastingProgress, fastingStats, hm } from "@/lib/bkn/fasting";
import { useFasting } from "@/lib/data/hooks";
import { deleteRow, upsertRow, uuid } from "@/lib/data/store";
import { addDays, formatShort, timeOf, toDateKey } from "@/lib/dates";
import type { FastingSession } from "@/lib/types";

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export default function FastingPage() {
  const { t, lang, profile, saveProfile, toast } = useApp();
  const today = toDateKey();
  const sessions = useFasting(addDays(today, -30), today);
  const [now, setNow] = useState(() => Date.now());
  const [startAt, setStartAt] = useState("");
  const target = profile?.fasting_target_hours ?? 16;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const list = [...(sessions.data ?? [])].sort((a, b) => b.started_at.localeCompare(a.started_at));
  const active = list.find((s) => !s.ended_at);
  const history = list.filter((s) => s.ended_at);
  const stats = fastingStats(list);
  const p = active ? fastingProgress(active, now) : null;
  const fmt = (hours: number) => {
    const { h, m } = hm(hours);
    return t("{h} sa {m} dk", { h, m: String(m).padStart(2, "0") });
  };
  const row = (s: FastingSession) => ({ id: s.id, entry_date: s.entry_date, started_at: s.started_at, ended_at: s.ended_at, target_hours: s.target_hours });

  async function start() {
    const started = startAt ? new Date(startAt) : new Date();
    if (isNaN(started.getTime()) || started.getTime() > Date.now() + 60_000) return toast(t("Başlangıç zamanı gelecekte olamaz."), "error");
    if (Date.now() - started.getTime() > 72 * 3_600_000) return toast(t("Başlangıç en fazla 72 saat önce olabilir."), "error");
    try {
      await upsertRow("fasting_sessions", { id: uuid(), entry_date: toDateKey(started), started_at: started.toISOString(), ended_at: null, target_hours: target });
      setStartAt("");
      setNow(Date.now());
      toast(t("Oruç başladı. Kolay gelsin!"));
    } catch {
      toast(t("Kaydedilemedi."), "error");
    }
  }

  async function stop() {
    if (!active) return;
    try {
      await upsertRow("fasting_sessions", { ...row(active), ended_at: new Date().toISOString() });
      toast(p?.done ? t("Tebrikler, hedefini tamamladın!") : t("Oruç sonlandırıldı."));
    } catch {
      toast(t("Kaydedilemedi."), "error");
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("Aralıklı oruç")} subtitle={t("Yeme penceresi ve kalan süre")} />

      <Card className="flex flex-col items-center gap-4 py-6">
        <Ring value={p ? p.hours : 0} max={active ? active.target_hours : target} size={200} stroke={16} overColor="var(--primary)" label={p ? t("Oruç: {a} / {b} saat", { a: Math.floor(p.hours), b: active!.target_hours }) : t("Oruç başlamadı")}>
          <Timer size={22} className="text-primary" />
          {p ? (
            <>
              <span className="text-2xl font-bold">{fmt(p.hours)}</span>
              <span className="text-xs text-muted">{p.done ? t("Hedef tamamlandı") : t("{x} kaldı", { x: fmt(p.remaining) })}</span>
            </>
          ) : (
            <>
              <span className="text-2xl font-bold">{target} {t("saat")}</span>
              <span className="text-xs text-muted">{t("hedef")}</span>
            </>
          )}
        </Ring>
        {active && p ? (
          <>
            <p className="text-center text-sm text-muted">
              {t("Başlangıç")}: {formatShort(active.entry_date, lang)} {timeOf(active.started_at)} · {t("Hedef bitiş")}: {timeOf(p.endsAt.toISOString())}
            </p>
            <Button size="lg" variant={p.done ? "primary" : "secondary"} className="w-full max-w-xs" onClick={stop}>
              {t("Orucu bitir")}
            </Button>
          </>
        ) : (
          <div className="w-full max-w-sm space-y-3">
            <Field label={t("Hedef süre")}>
              <div className="flex flex-wrap gap-2">
                {FASTING_PRESETS.map((h) => (
                  <Chip key={h} active={target === h} onClick={() => saveProfile({ fasting_target_hours: h }).catch(() => toast(t("Kaydedilemedi."), "error"))}>
                    {h}:{24 - h}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label={t("Başlangıç zamanı")} hint={t("Boş bırakırsanız şimdi başlar. Son yemeğinizin saatini de girebilirsiniz.")}>
              <Input type="datetime-local" value={startAt} max={toLocalInput(new Date())} onChange={(e) => setStartAt(e.target.value)} />
            </Field>
            <Button size="lg" className="w-full" onClick={start}>
              {t("Orucu başlat")}
            </Button>
          </div>
        )}
      </Card>

      <Card className="mt-4 grid grid-cols-3 gap-3">
        <Stat label={t("Tamamlanan")} value={`${stats.reached}/${stats.completed}`} />
        <Stat label={t("Ortalama")} value={stats.completed ? fmt(stats.average) : "–"} />
        <Stat label={t("En uzun")} value={stats.completed ? fmt(stats.longest) : "–"} />
      </Card>

      <Card className="mt-4 p-0">
        <p className="px-4 py-3 text-sm font-semibold">{t("Son 30 gün")}</p>
        {history.length === 0 ? (
          <Empty icon={<Timer size={22} />} title={t("Henüz tamamlanan oruç yok")} />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {history.map((s) => {
              const hours = elapsedHours(s);
              return (
                <li key={s.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {fmt(hours)} <span className={`text-xs font-normal ${hours >= s.target_hours ? "text-primary" : "text-muted"}`}>· {hours >= s.target_hours ? t("hedef tamam") : t("hedef {n} saat", { n: s.target_hours })}</span>
                    </p>
                    <p className="text-xs text-muted">
                      {formatShort(s.entry_date, lang)} {timeOf(s.started_at)} → {timeOf(s.ended_at!)}
                    </p>
                  </div>
                  <button type="button" aria-label={t("Sil")} onClick={() => confirm(t("Bu kayıt silinsin mi?")) && deleteRow("fasting_sessions", s.id).catch(() => toast(t("Silinemedi."), "error"))} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:text-danger">
                    <Trash2 size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <p className="mt-4 text-xs text-muted">{t("Aralıklı oruç herkes için uygun değildir. Diyabet, hamilelik, emzirme, yeme bozukluğu öyküsü ya da düzenli ilaç kullanımı varsa başlamadan önce hekiminize danışın.")}</p>
    </div>
  );
}
