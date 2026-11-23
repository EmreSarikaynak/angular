"use client";
import { useCallback, useEffect, useState } from "react";
import { Copy, Link2, ShieldCheck } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button, Card, Empty, Field, Input, PageHeader, Select, Switch } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";
import { MyDietitian } from "@/components/my-dietitian";
import type { ShareLink } from "@/lib/types";

export default function SharingPage() {
  const { t, lang, toast, online } = useApp();
  const [links, setLinks] = useState<ShareLink[] | null>(null);
  const [label, setLabel] = useState("");
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [valid, setValid] = useState<1 | 7 | 30>(7);
  const [meals, setMeals] = useState(true);
  const [body, setBody] = useState(true);
  const [wellbeing, setWellbeing] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase().from("share_links").select("id, label, days, include_meals, include_body, include_wellbeing, expires_at, revoked_at, last_viewed_at, view_count, created_at").order("created_at", { ascending: false });
    setLinks((data ?? []) as ShareLink[]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const dt = (s: string) => new Date(s).toLocaleString(lang === "en" ? "en-GB" : "tr-TR", { dateStyle: "medium", timeStyle: "short" });
  const [now] = useState(() => Date.now());
  const isActive = (l: ShareLink) => !l.revoked_at && new Date(l.expires_at).getTime() > now;

  async function create() {
    if (!consent) return toast(t("Devam etmek için paylaşımı onaylayın."), "error");
    setBusy(true);
    try {
      const res = await api<{ token: string }>("/api/share", { body: { label: label.trim() || undefined, days, valid_days: valid, include_meals: meals, include_body: body, include_wellbeing: wellbeing } });
      setCreated(`${location.origin}/share/${res.token}`);
      setConsent(false);
      setLabel("");
      await load();
    } catch (e) {
      toast(e instanceof ApiError && e.code === "too_many_links" ? t("En fazla 5 etkin bağlantınız olabilir. Önce birini iptal edin.") : t("Bağlantı oluşturulamadı."), "error");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(l: ShareLink) {
    if (!confirm(t("Bu bağlantı iptal edilsin mi? Bağlantıya sahip olan kişi artık verilerinizi göremez."))) return;
    const { error } = await supabase().from("share_links").update({ revoked_at: new Date().toISOString() }).eq("id", l.id);
    if (error) return toast(t("İptal edilemedi."), "error");
    toast(t("Bağlantı iptal edildi."), "info");
    await load();
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast(t("Bağlantı kopyalandı."));
    } catch {
      toast(t("Kopyalanamadı; bağlantıyı elle seçip kopyalayın."), "error");
    }
  }

  const toggle = (title: string, sub: string, value: boolean, set: (v: boolean) => void) => (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted">{sub}</p>
      </div>
      <Switch checked={value} onChange={set} label={title} />
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={t("Diyetisyen / koç paylaşımı")} subtitle={t("Diyetisyeninize bağlanın ya da süreli bir rapor bağlantısı oluşturun")} />

      <MyDietitian />

      <h2 className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("Tek seferlik rapor bağlantısı")}</h2>

      {created && (
        <Card className="border-primary">
          <p className="flex items-center gap-2 font-semibold text-primary">
            <ShieldCheck size={18} />
            {t("Bağlantınız hazır")}
          </p>
          <p className="mt-1 text-xs text-muted">{t("Bu bağlantı güvenlik nedeniyle yalnızca şimdi gösterilir. Kopyalayıp yalnızca güvendiğiniz kişiyle paylaşın.")}</p>
          <div className="mt-2 flex gap-2">
            <Input readOnly value={created} aria-label={t("Paylaşım bağlantısı")} onFocus={(e) => e.target.select()} className="text-sm" />
            <Button onClick={() => copy(created)} className="shrink-0">
              <Copy size={16} />
              {t("Kopyala")}
            </Button>
          </div>
        </Card>
      )}

      <Card className="space-y-4">
        <p className="font-semibold">{t("Yeni bağlantı")}</p>
        <Field label={t("Kiminle paylaşıyorsunuz? (isteğe bağlı)")}>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder={t("Örn. Dyt. Elif Hanım")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Rapor dönemi")}>
            <Select value={days} onChange={(e) => setDays(Number(e.target.value) as 7 | 30 | 90)}>
              <option value={7}>{t("Son 7 gün")}</option>
              <option value={30}>{t("Son 30 gün")}</option>
              <option value={90}>{t("Son 90 gün")}</option>
            </Select>
          </Field>
          <Field label={t("Bağlantı geçerliliği")}>
            <Select value={valid} onChange={(e) => setValid(Number(e.target.value) as 1 | 7 | 30)}>
              <option value={1}>{t("1 gün")}</option>
              <option value={7}>{t("7 gün")}</option>
              <option value={30}>{t("30 gün")}</option>
            </Select>
          </Field>
        </div>
        <p className="text-xs text-muted">{t("Her zaman paylaşılır: adınız, yaşınız, hedefleriniz, alerjileriniz, günlük kalori/makro/su/adım özetleri ve aktivite toplamları.")}</p>
        {toggle(t("Öğün ayrıntıları"), t("Yediğiniz her yiyeceğin adı, miktarı ve kalorisi."), meals, setMeals)}
        {toggle(t("Kilo ve vücut ölçümleri"), t("Kilo, VKİ, bel çevresi ve yağ oranı kayıtları."), body, setBody)}
        {toggle(t("Uyku ve ruh hali"), t("Uyku süresi, ruh hali, enerji ve stres puanları."), wellbeing, setWellbeing)}
        <p className="text-xs text-muted">{t("Hiçbir zaman paylaşılmaz: soyadınız, e-postanız, doğum tarihiniz, fotoğraflarınız, günlük notlarınız ve asistan sohbetleriniz.")}</p>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
          <span>{t("Seçtiğim sağlık verilerimin, bu bağlantıya sahip olan kişilerce görüntülenmesine açık rıza veriyorum.")}</span>
        </label>
        <Button size="lg" className="w-full" loading={busy} disabled={!online || !consent} onClick={create}>
          <Link2 size={18} />
          {t("Bağlantı oluştur")}
        </Button>
      </Card>

      <Card className="p-0">
        <p className="px-4 py-3 text-sm font-semibold">{t("Bağlantılarım")}</p>
        {!links ? null : links.length === 0 ? (
          <Empty icon={<Link2 size={22} />} title={t("Henüz paylaşım bağlantınız yok")} />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {links.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {l.label || t("Adsız bağlantı")}
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isActive(l) ? "bg-primary-soft text-primary" : "bg-surface-2 text-muted"}`}>{l.revoked_at ? t("İptal edildi") : isActive(l) ? t("Etkin") : t("Süresi doldu")}</span>
                  </p>
                  <p className="truncate text-xs text-muted">
                    {t("Son {n} gün", { n: l.days })} · {t("Bitiş")}: {dt(l.expires_at)}
                  </p>
                  <p className="truncate text-xs text-muted">{l.view_count > 0 ? t("{n} kez görüntülendi · son: {d}", { n: l.view_count, d: dt(l.last_viewed_at ?? l.created_at) }) : t("Henüz görüntülenmedi")}</p>
                </div>
                {isActive(l) && (
                  <Button size="sm" variant="secondary" onClick={() => revoke(l)}>
                    {t("İptal et")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
