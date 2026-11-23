"use client";
import { Suspense, useState } from "react";
import { Check, Pencil, Pill, Plus, Trash2, X } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { DateNav, useDateParam } from "@/components/date-nav";
import { Bar, Button, Card, Empty, Field, Input, NumberInput, PageHeader, Sheet, Skeleton, Switch, cx } from "@/components/ui";
import { useSupplementLogs, useSupplements } from "@/lib/data/hooks";
import { deleteRow, upsertRow, uuid } from "@/lib/data/store";
import { supplementSlots } from "@/lib/bkn/score";
import { LOW_STOCK_DAYS, stockDaysLeft } from "@/lib/bkn/fasting";
import { takeSupplement, untakeSupplement } from "@/lib/data/actions";
import { timeOf, toDateKey } from "@/lib/dates";
import type { Supplement } from "@/lib/types";

const blank = (): Supplement => ({ id: uuid(), name: "", dose: "", times: ["09:00"], active: true, note: "", stock_count: null, per_dose: 1 });

function SupplementsInner() {
  const { t, toast, profile } = useApp();
  const [date, setDate] = useDateParam();
  const supplements = useSupplements();
  const logs = useSupplementLogs(date, date);
  const [editing, setEditing] = useState<Supplement | null>(null);
  const [busy, setBusy] = useState(false);

  const list = supplements.data ?? [];
  const slots = supplementSlots(list, logs.data ?? [], date);
  const taken = slots.filter((s) => s.log).length;
  const nowTime = timeOf(new Date().toISOString());
  const isToday = date === toDateKey();

  async function toggle(slot: (typeof slots)[number]) {
    try {
      if (slot.log) await untakeSupplement(slot.supplement, slot.log);
      else {
        await takeSupplement(slot.supplement, date, slot.time);
        toast(t("Harika! {name} tamamlandı.", { name: slot.supplement.name }));
      }
    } catch {
      toast(t("Kaydedilemedi."), "error");
    }
  }

  async function save() {
    if (!editing) return;
    const times = [...new Set(editing.times.filter((x) => /^\d{2}:\d{2}$/.test(x)))].sort();
    if (!editing.name.trim()) return toast(t("Takviye adını girin."), "error");
    if (times.length === 0) return toast(t("En az bir saat ekleyin."), "error");
    setBusy(true);
    try {
      const { queued } = await upsertRow("supplements", { id: editing.id, name: editing.name.trim().slice(0, 120), dose: editing.dose?.trim().slice(0, 80) || null, times, active: editing.active, note: editing.note?.trim().slice(0, 300) || null, stock_count: editing.stock_count == null ? null : Math.max(0, Math.round(editing.stock_count)), per_dose: Math.max(1, Math.round(editing.per_dose ?? 1)) });
      toast(queued ? t("Cihaza kaydedildi; bağlantı gelince gönderilecek.") : t("Takviye kaydedildi."), queued ? "info" : "ok");
      setEditing(null);
    } catch {
      toast(t("Kaydedilemedi."), "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: Supplement) {
    if (!confirm(t("“{name}” ve geçmiş kayıtları silinsin mi?", { name: s.name }))) return;
    try {
      await deleteRow("supplements", s.id);
      setEditing(null);
    } catch {
      toast(t("Silinemedi."), "error");
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={t("Takviyeler")}
        subtitle={t("Saatini ve dozunu siz belirleyin, BKNY hatırlatsın.")}
        action={
          <Button size="sm" onClick={() => setEditing(blank())}>
            <Plus size={16} />
            {t("Ekle")}
          </Button>
        }
      />
      <DateNav date={date} onChange={setDate} />

      {supplements.loading && !supplements.data ? (
        <Skeleton className="h-40" />
      ) : list.length === 0 ? (
        <Card>
          <Empty
            icon={<Pill size={22} />}
            title={t("Henüz takviye eklemediniz")}
            text={t("Kullandığınız vitamin veya takviyeyi, dozunu ve saatlerini ekleyin; zamanı geldiğinde hatırlatalım.")}
            action={
              <Button size="sm" onClick={() => setEditing(blank())}>
                <Plus size={16} />
                {t("Takviye ekle")}
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <Card className="mb-4">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-sm font-semibold">{isToday ? t("Bugünün planı") : t("Günün planı")}</p>
              <p className="text-sm font-semibold text-primary">
                {taken} / {slots.length}
              </p>
            </div>
            <Bar value={taken} max={slots.length} />
            {slots.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{t("Etkin takviye yok.")}</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {slots.map((slot) => {
                  const late = isToday && !slot.log && slot.time < nowTime;
                  return (
                    <li key={`${slot.supplement.id}-${slot.time}`} className="flex items-center gap-3 py-2.5">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={!!slot.log}
                        aria-label={`${slot.supplement.name} ${slot.time}`}
                        onClick={() => toggle(slot)}
                        className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 transition-colors", slot.log ? "border-primary bg-primary text-white" : late ? "border-warn text-warn" : "border-border text-transparent")}
                      >
                        <Check size={18} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={cx("truncate text-sm font-medium", slot.log && "text-muted line-through")}>{slot.supplement.name}</p>
                        <p className="truncate text-xs text-muted">
                          {slot.time}
                          {slot.supplement.dose ? ` · ${slot.supplement.dose}` : ""}
                          {slot.log ? ` · ${t("alındı")} ${timeOf(slot.log.taken_at)}` : late ? ` · ${t("saati geçti")}` : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="p-0">
            <p className="px-4 py-3 text-sm font-semibold">{t("Takviyelerim")}</p>
            <ul className="divide-y divide-border border-t border-border">
              {list.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className={cx("truncate text-sm font-medium", !s.active && "text-muted")}>{s.name}</p>
                    <p className="truncate text-xs text-muted">
                      {[s.dose, [...s.times].sort().join(", "), !s.active && t("duraklatıldı")].filter(Boolean).join(" · ")}
                    </p>
                    {s.stock_count != null && (
                      <p className={cx("text-xs", (stockDaysLeft(s) ?? 99) <= LOW_STOCK_DAYS ? "font-semibold text-warn" : "text-muted")}>
                        {t("Stok: {n} adet · yaklaşık {d} gün", { n: s.stock_count, d: stockDaysLeft(s) ?? 0 })}
                        {(stockDaysLeft(s) ?? 99) <= LOW_STOCK_DAYS ? ` · ${t("azalıyor")}` : ""}
                      </p>
                    )}
                  </div>
                  <button type="button" aria-label={t("Düzenle")} onClick={() => setEditing({ ...s, dose: s.dose ?? "", note: s.note ?? "" })} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface-2">
                    <Pencil size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {!profile?.notify_supplements && <p className="mt-3 rounded-xl bg-warn/10 px-3 py-2 text-xs text-warn">{t("Takviye bildirimleri kapalı. Profil › Bildirimler bölümünden açabilirsiniz.")}</p>}
        </>
      )}
      <p className="mt-4 text-xs text-muted">{t("BKNY takviye veya doz önermez; yalnızca sizin girdiğiniz planı hatırlatır. Takviye kullanımı için hekiminize veya eczacınıza danışın.")}</p>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing && list.some((s) => s.id === editing.id) ? t("Takviyeyi düzenle") : t("Takviye ekle")}>
        {editing && (
          <div className="space-y-3">
            <Field label={t("Takviye adı")}>
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={120} placeholder={t("Örn. D vitamini")} />
            </Field>
            <Field label={t("Doz")} hint={t("Kutunun üzerindeki ya da hekiminizin önerdiği miktar.")}>
              <Input value={editing.dose ?? ""} onChange={(e) => setEditing({ ...editing, dose: e.target.value })} maxLength={80} placeholder={t("Örn. 1 kapsül, 1000 IU")} />
            </Field>
            <Field label={t("Saatler")}>
              <div className="space-y-2">
                {editing.times.map((time, i) => (
                  <div key={i} className="flex gap-2">
                    <Input type="time" value={time} aria-label={t("Saat {n}", { n: i + 1 })} onChange={(e) => setEditing({ ...editing, times: editing.times.map((x, j) => (j === i ? e.target.value : x)) })} />
                    {editing.times.length > 1 && (
                      <button type="button" aria-label={t("Saati kaldır")} onClick={() => setEditing({ ...editing, times: editing.times.filter((_, j) => j !== i) })} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                {editing.times.length < 8 && (
                  <Button variant="secondary" size="sm" onClick={() => setEditing({ ...editing, times: [...editing.times, "21:00"] })}>
                    <Plus size={16} />
                    {t("Saat ekle")}
                  </Button>
                )}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("Kutuda kalan adet")} hint={t("Boş bırakırsanız stok takip edilmez.")}>
                <NumberInput value={editing.stock_count ?? null} onChange={(v) => setEditing({ ...editing, stock_count: v })} min={0} max={100000} />
              </Field>
              <Field label={t("Her alımda adet")}>
                <NumberInput value={editing.per_dose ?? 1} onChange={(v) => setEditing({ ...editing, per_dose: v ?? 1 })} min={1} max={100} />
              </Field>
            </div>
            <Field label={t("Not")}>
              <Input value={editing.note ?? ""} onChange={(e) => setEditing({ ...editing, note: e.target.value })} maxLength={300} placeholder={t("Örn. tok karnına")} />
            </Field>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t("Etkin (hatırlatılsın)")}</span>
              <Switch checked={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} label={t("Etkin (hatırlatılsın)")} />
            </div>
            <div className="flex gap-2 pt-1">
              {list.some((s) => s.id === editing.id) && (
                <Button variant="secondary" onClick={() => remove(editing)} aria-label={t("Sil")}>
                  <Trash2 size={16} />
                </Button>
              )}
              <Button className="flex-1" size="lg" loading={busy} onClick={save}>
                {t("Kaydet")}
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

export default function SupplementsPage() {
  return (
    <Suspense>
      <SupplementsInner />
    </Suspense>
  );
}
