"use client";
import { Suspense, useState } from "react";
import { Bell, Droplets, Trash2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { DateNav, useDateParam } from "@/components/date-nav";
import { Button, Card, Empty, Field, NumberInput, PageHeader, Ring, Select, Sheet, Switch } from "@/components/ui";
import { useDay } from "@/lib/data/hooks";
import { addWater } from "@/lib/data/actions";
import { deleteRow } from "@/lib/data/store";
import { timeOf } from "@/lib/dates";
import { numberFmt } from "@/lib/i18n";
import { disableNotifications, enableNotifications, unsupportedText } from "@/lib/push";

const QUICK = [100, 200, 250, 330, 500, 1000];

function WaterInner() {
  const { t, lang, profile, saveProfile, toast } = useApp();
  const [date, setDate] = useDateParam();
  const day = useDay(date);
  const [custom, setCustom] = useState<number | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);

  const logs = [...(day.data?.water ?? [])].sort((a, b) => b.logged_at.localeCompare(a.logged_at));
  const total = logs.reduce((s, w) => s + w.amount_ml, 0);
  const target = profile?.water_target_ml ?? 2000;
  const remaining = Math.max(0, target - total);
  const percent = target ? Math.round((total / target) * 100) : 0;
  const nf = (n: number) => numberFmt(lang, n);

  async function add(ml: number) {
    if (!ml || ml <= 0 || ml > 5000) return toast(t("Miktar 1–5000 ml arasında olmalı."), "error");
    try {
      const { queued } = await addWater(date, ml);
      toast(queued ? t("{n} ml cihaza kaydedildi", { n: ml }) : t("{n} ml su eklendi", { n: ml }), queued ? "info" : "ok");
    } catch {
      toast(t("Kaydedilemedi."), "error");
    }
  }

  async function toggleReminder(on: boolean) {
    setReminderBusy(true);
    try {
      if (on) {
        const result = await enableNotifications();
        if (result === "unsupported") return toast(unsupportedText(t), "error");
        if (result === "denied") return toast(t("Bildirim izni verilmedi. Tarayıcı ayarlarından izin verebilirsiniz."), "error");
        await saveProfile({ reminder_enabled: true, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || profile?.timezone });
        toast(result === "push" ? t("Hatırlatmalar açıldı.") : t("Hatırlatmalar açıldı (uygulama açıkken gösterilir)."));
      } else {
        await disableNotifications();
        await saveProfile({ reminder_enabled: false });
        toast(t("Hatırlatmalar kapatıldı."), "info");
      }
    } catch {
      toast(t("Kaydedilemedi."), "error");
    } finally {
      setReminderBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title={t("Su takibi")} />
      <DateNav date={date} onChange={setDate} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col items-center gap-4 py-6">
          <Ring value={total} max={target} size={190} stroke={16} color="var(--water)" overColor="var(--water)" label={t("Su: {a} / {b} ml", { a: total, b: target })}>
            <Droplets size={22} className="text-water" />
            <span className="text-3xl font-bold">{percent}%</span>
            <span className="text-xs text-muted">
              {nf(total)} / {nf(target)} ml
            </span>
          </Ring>
          <div className="grid w-full grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[11px] text-muted">{t("Hedef")}</p>
              <p className="font-semibold">{nf(target)} ml</p>
            </div>
            <div>
              <p className="text-[11px] text-muted">{t("İçilen")}</p>
              <p className="font-semibold text-water">{nf(total)} ml</p>
            </div>
            <div>
              <p className="text-[11px] text-muted">{t("Kalan")}</p>
              <p className="font-semibold">{nf(remaining)} ml</p>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <p className="mb-3 text-sm font-semibold">{t("Hızlı ekle")}</p>
            <div className="grid grid-cols-3 gap-2">
              {QUICK.map((ml) => (
                <button key={ml} type="button" onClick={() => add(ml)} className="rounded-xl border border-border bg-surface py-3 text-sm font-semibold active:bg-primary-soft">
                  {ml === 1000 ? t("1 litre") : `${ml} ml`}
                </button>
              ))}
              <button type="button" onClick={() => setCustomOpen(true)} className="col-span-3 rounded-xl border border-dashed border-border py-3 text-sm font-medium text-muted">
                {t("Özel miktar")}
              </button>
            </div>
            <p className="mt-3 text-xs text-muted">{t("Alkollü ve diğer içecekler su tüketimine sayılmaz; onları İçecekler bölümünden ekleyin.")}</p>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-muted" />
                <div>
                  <p className="text-sm font-semibold">{t("Su içme hatırlatmaları")}</p>
                  <p className="text-xs text-muted">{t("Hedefe ulaşana kadar belirlediğiniz aralıkla bildirim gönderilir.")}</p>
                </div>
              </div>
              <Switch checked={!!profile?.reminder_enabled} onChange={(v) => !reminderBusy && toggleReminder(v)} label={t("Su içme hatırlatmaları")} />
            </div>
            {profile?.reminder_enabled && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Field label={t("Aralık")}>
                  <Select value={profile.reminder_interval_min} onChange={(e) => saveProfile({ reminder_interval_min: Number(e.target.value) }).catch(() => toast(t("Kaydedilemedi."), "error"))}>
                    {[30, 60, 90, 120, 180, 240].map((m) => (
                      <option key={m} value={m}>
                        {m < 60 ? `${m} ${t("dk")}` : `${m / 60} ${t("saat")}`}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("Başlangıç")}>
                  <Select value={profile.reminder_start_hour} onChange={(e) => saveProfile({ reminder_start_hour: Number(e.target.value) }).catch(() => toast(t("Kaydedilemedi."), "error"))}>
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>{`${String(h).padStart(2, "0")}:00`}</option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("Bitiş")}>
                  <Select value={profile.reminder_end_hour} onChange={(e) => saveProfile({ reminder_end_hour: Number(e.target.value) }).catch(() => toast(t("Kaydedilemedi."), "error"))}>
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>{`${String(h).padStart(2, "0")}:00`}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card className="mt-4 p-0">
        <p className="px-4 py-3 text-sm font-semibold">{t("Günün kayıtları")}</p>
        {logs.length === 0 ? (
          <Empty icon={<Droplets size={22} />} title={t("Bu gün için su kaydı yok")} />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {logs.map((w) => (
              <li key={w.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm">
                  <b>{nf(w.amount_ml)} ml</b> <span className="text-muted">· {timeOf(w.logged_at)}</span>
                </span>
                <button type="button" aria-label={t("Sil")} onClick={() => deleteRow("water_logs", w.id).catch(() => toast(t("Silinemedi."), "error"))} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:text-danger">
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Sheet open={customOpen} onClose={() => setCustomOpen(false)} title={t("Özel miktar")}>
        <div className="space-y-3">
          <Field label={t("Miktar (ml)")}>
            <NumberInput value={custom} onChange={setCustom} min={1} max={5000} autoFocus />
          </Field>
          <Button
            className="w-full"
            size="lg"
            disabled={!custom || custom <= 0}
            onClick={async () => {
              await add(custom ?? 0);
              setCustomOpen(false);
              setCustom(null);
            }}
          >
            {t("Ekle")}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

export default function WaterPage() {
  return (
    <Suspense>
      <WaterInner />
    </Suspense>
  );
}
