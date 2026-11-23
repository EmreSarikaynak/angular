"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, MessageSquareText, Stethoscope } from "lucide-react";
import { useApp } from "./app-provider";
import { Button, Card, Field, Input, Switch } from "./ui";
import { api, ApiError } from "@/lib/api";

interface MyDietitian {
  link_id: string;
  name: string;
  title: string | null;
  since: string;
  sections: { meals: boolean; body: boolean; wellbeing: boolean };
  notes: { id: string; content: string; created_at: string }[];
}

function useMyDietitians() {
  const [list, setList] = useState<MyDietitian[] | null>(null);
  const load = useCallback(async () => {
    try {
      setList((await api<{ dietitians: MyDietitian[] }>("/api/dietitian")).dietitians);
    } catch {
      setList((cur) => cur ?? []);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { list, setList };
}

/** Danışan tarafı: diyetisyene kodla bağlanma, paylaşılan bölümleri yönetme, notları okuma. */
export function MyDietitian() {
  const { t, lang, toast, online } = useApp();
  const { list, setList } = useMyDietitians();
  const [code, setCode] = useState("");
  const [meals, setMeals] = useState(true);
  const [body, setBody] = useState(true);
  const [wellbeing, setWellbeing] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send(payload: Record<string, unknown>, done: string) {
    setBusy(true);
    try {
      setList((await api<{ dietitians: MyDietitian[] }>("/api/dietitian", { body: payload })).dietitians);
      toast(done);
      return true;
    } catch (e) {
      const c = e instanceof ApiError ? e.code : "";
      toast(
        c === "dietitian_not_found" ? t("Bu kodla bir diyetisyen bulunamadı.") : c === "already_connected" ? t("Bu diyetisyene zaten bağlısınız.") : c === "cannot_connect_self" ? t("Kendi kodunuzla bağlanamazsınız.") : c === "too_many_dietitians" ? t("En fazla 3 diyetisyene bağlanabilirsiniz.") : t("İşlem tamamlanamadı. Lütfen tekrar deneyin."),
        "error",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  const dt = (iso: string) => new Date(iso).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR", { day: "numeric", month: "long" });
  const row = (title: string, sub: string, value: boolean, set: (v: boolean) => void) => (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted">{sub}</p>
      </div>
      <Switch checked={value} onChange={set} label={title} />
    </div>
  );

  return (
    <div className="space-y-4">
      {(list ?? []).map((d) => (
        <Card key={d.link_id} className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-semibold">
                <Stethoscope size={17} className="shrink-0 text-primary" />
                <span className="truncate">{d.name}</span>
              </p>
              <p className="text-xs text-muted">
                {[d.title, t("{d} tarihinden beri bağlı", { d: dt(d.since) })].filter(Boolean).join(" · ")}
              </p>
            </div>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => confirm(t("{name} ile paylaşım sonlandırılsın mı? Kayıtlarınızı artık göremez ve hakkınızdaki notları silinir.", { name: d.name })) && send({ action: "end", link_id: d.link_id }, t("Paylaşım sonlandırıldı."))}>
              {t("Paylaşımı bitir")}
            </Button>
          </div>
          <div className="space-y-2.5 rounded-xl bg-surface-2 p-3">
            <p className="text-xs font-semibold text-muted">{t("Diyetisyeninizin gördükleri")}</p>
            {row(t("Öğün ayrıntıları"), t("Yediğiniz her yiyeceğin adı, miktarı ve kalorisi."), d.sections.meals, (v) => send({ action: "sections", link_id: d.link_id, include_meals: v, include_body: d.sections.body, include_wellbeing: d.sections.wellbeing }, t("Kaydedildi.")))}
            {row(t("Kilo ve vücut ölçümleri"), t("Kilo, VKİ, bel çevresi ve yağ oranı kayıtları."), d.sections.body, (v) => send({ action: "sections", link_id: d.link_id, include_meals: d.sections.meals, include_body: v, include_wellbeing: d.sections.wellbeing }, t("Kaydedildi.")))}
            {row(t("Uyku ve ruh hali"), t("Uyku süresi, ruh hali, enerji ve stres puanları."), d.sections.wellbeing, (v) => send({ action: "sections", link_id: d.link_id, include_meals: d.sections.meals, include_body: d.sections.body, include_wellbeing: v }, t("Kaydedildi.")))}
          </div>
          <div>
            <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
              <MessageSquareText size={15} className="text-muted" />
              {t("Diyetisyeninizin notları")}
            </p>
            {d.notes.length === 0 ? (
              <p className="text-sm text-muted">{t("Henüz not bırakılmadı.")}</p>
            ) : (
              <ul className="space-y-2">
                {d.notes.map((n) => (
                  <li key={n.id} className="rounded-xl border border-border p-3">
                    <p className="whitespace-pre-wrap text-sm">{n.content}</p>
                    <p className="mt-1 text-[11px] text-muted">{dt(n.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      ))}

      <Card className="space-y-3">
        <h2 className="font-semibold">{t("Diyetisyenime bağlan")}</h2>
        <p className="text-xs text-muted">{t("Diyetisyeninizin verdiği 8 haneli kodu girin. Bağlandığınızda adınız-soyadınız, yaşınız, hedefleriniz, alerjileriniz ve günlük özetleriniz sürekli olarak paylaşılır; aşağıdaki bölümleri siz seçersiniz.")}</p>
        <Field label={t("Diyetisyen kodu")}>
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))} placeholder="ABCD2345" autoCapitalize="characters" className="tracking-widest" />
        </Field>
        {row(t("Öğün ayrıntıları"), t("Yediğiniz her yiyeceğin adı, miktarı ve kalorisi."), meals, setMeals)}
        {row(t("Kilo ve vücut ölçümleri"), t("Kilo, VKİ, bel çevresi ve yağ oranı kayıtları."), body, setBody)}
        {row(t("Uyku ve ruh hali"), t("Uyku süresi, ruh hali, enerji ve stres puanları."), wellbeing, setWellbeing)}
        <p className="text-xs text-muted">{t("Hiçbir zaman paylaşılmaz: e-postanız, doğum tarihiniz, fotoğraflarınız, günlük notlarınız, döngü kayıtlarınız ve asistan sohbetleriniz.")}</p>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
          <span>{t("Seçtiğim sağlık verilerimin bu diyetisyen tarafından, ben paylaşımı bitirene kadar görüntülenmesine açık rıza veriyorum.")}</span>
        </label>
        <Button
          size="lg"
          className="w-full"
          loading={busy}
          disabled={!online || code.length !== 8 || !consent}
          onClick={async () => {
            if (await send({ action: "connect", code, consent: true, include_meals: meals, include_body: body, include_wellbeing: wellbeing }, t("Diyetisyeninize bağlandınız."))) {
              setCode("");
              setConsent(false);
            }
          }}
        >
          {t("Bağlan")}
        </Button>
      </Card>
    </div>
  );
}

/** Ana sayfa: diyetisyenin son 14 gündeki en yeni notu. */
export function DietitianNoteCard() {
  const { t } = useApp();
  const { list } = useMyDietitians();
  const [cutoff] = useState(() => Date.now() - 14 * 86_400_000);
  const latest = (list ?? [])
    .flatMap((d) => d.notes.map((n) => ({ ...n, name: d.name })))
    .filter((n) => new Date(n.created_at).getTime() > cutoff)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (!latest) return null;
  return (
    <Card>
      <Link href="/sharing" className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
          <Stethoscope size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-primary">{t("{name} size not bıraktı", { name: latest.name })}</p>
          <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-sm">{latest.content}</p>
        </div>
        <ChevronRight size={18} className="mt-1 shrink-0 text-muted" />
      </Link>
    </Card>
  );
}
