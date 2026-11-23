"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ChevronRight, Copy, Stethoscope, Users } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button, Card, Empty, Field, Input, PageHeader, Segmented, Skeleton, Stat } from "@/components/ui";
import { api } from "@/lib/api";
import { daysBetween, formatShort, toDateKey } from "@/lib/dates";
import { GOAL_LABELS, label } from "@/lib/i18n/labels";

interface Client {
  link_id: string;
  name: string;
  goal: string | null;
  since: string;
  sections: { meals: boolean; body: boolean; wellbeing: boolean };
  logged_days_7: number;
  last_log: string | null;
  avg_kcal_7: number | null;
  kcal_target: number | null;
  last_note_at: string | null;
}
interface Overview {
  dietitian: { display_name: string; title: string | null; invite_code: string } | null;
  clients: Client[];
}

export default function DietitianPage() {
  const { t, lang, profile, toast, online } = useApp();
  const [data, setData] = useState<Overview | null>(null);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"attention" | "name">("attention");
  const today = toDateKey();

  const load = useCallback(async () => {
    try {
      setData(await api<Overview>("/api/dietitian"));
    } catch {
      setData((d) => d ?? { dietitian: null, clients: [] });
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function enable() {
    setBusy(true);
    try {
      setData(await api<Overview>("/api/dietitian", { body: { action: "enable", display_name: name.trim(), title: title.trim() || undefined } }));
      toast(t("Diyetisyen paneliniz hazır."));
    } catch {
      toast(t("Kaydedilemedi."), "error");
    } finally {
      setBusy(false);
    }
  }

  async function share(code: string) {
    const text = t("BKN'de diyetisyeniniz olarak beni ekleyin. Profil › Diyetisyenimle paylaş bölümüne şu kodu girin: {code}", { code });
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast(t("Davet metni kopyalandı."));
      }
    } catch {
      /* iptal */
    }
  }

  if (!data) return <Skeleton className="h-64" />;

  if (!data.dietitian) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title={t("Diyetisyen paneli")} subtitle={t("Danışanlarınızı tek ekrandan izleyin")} />
        <Card className="space-y-3">
          <p className="flex items-center gap-2 font-semibold">
            <Stethoscope size={18} className="text-primary" />
            {t("Paneli etkinleştir")}
          </p>
          <p className="text-sm text-muted">{t("Size özel bir davet kodu oluşturulur. Danışanlarınız bu kodu kendi hesaplarına girip açık rıza verdiklerinde, izin verdikleri kayıtları burada görürsünüz.")}</p>
          <Field label={t("Danışanlarınıza görünecek adınız")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={[profile?.first_name, profile?.last_name].filter(Boolean).join(" ")} />
          </Field>
          <Field label={t("Unvan (isteğe bağlı)")}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder={t("Örn. Diyetisyen, Beslenme uzmanı")} />
          </Field>
          <Button size="lg" className="w-full" loading={busy} disabled={!online || name.trim().length < 2} onClick={enable}>
            {t("Paneli etkinleştir")}
          </Button>
          <p className="text-xs text-muted">{t("Danışan verilerine erişirken mesleki gizlilik ve KVKK yükümlülükleri size aittir. BKN unvanınızı doğrulamaz.")}</p>
        </Card>
      </div>
    );
  }

  const needs = (c: Client) => !c.last_log || daysBetween(c.last_log, today) >= 3;
  const list = data.clients
    .filter((c) => !query.trim() || c.name.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr")))
    .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name, "tr") : Number(needs(b)) - Number(needs(a)) || (a.last_log ?? "").localeCompare(b.last_log ?? "")));
  const active7 = data.clients.filter((c) => c.logged_days_7 > 0).length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("Diyetisyen paneli")} subtitle={[data.dietitian.display_name, data.dietitian.title].filter(Boolean).join(" · ")} />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted">{t("Davet kodunuz")}</p>
            <p className="text-2xl font-bold tracking-[0.2em] text-primary">{data.dietitian.invite_code}</p>
          </div>
          <Button variant="secondary" onClick={() => share(data.dietitian!.invite_code)}>
            <Copy size={16} />
            {t("Daveti paylaş")}
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
          <Stat label={t("Danışan")} value={String(data.clients.length)} />
          <Stat label={t("Son 7 günde kayıt giren")} value={String(active7)} />
          <Stat label={t("İlgi bekleyen")} value={String(data.clients.filter(needs).length)} color={data.clients.some(needs) ? "var(--warn)" : undefined} />
        </div>
      </Card>

      {data.clients.length === 0 ? (
        <Card>
          <Empty icon={<Users size={22} />} title={t("Henüz danışanınız yok")} text={t("Davet kodunuzu danışanlarınızla paylaşın. Onlar kodu girip onay verdiğinde burada görünürler.")} />
        </Card>
      ) : (
        <>
          <div className="mb-3 flex gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Danışan ara")} aria-label={t("Danışan ara")} />
            <Segmented className="shrink-0" value={sort} onChange={setSort} options={[{ value: "attention", label: t("Öncelik") }, { value: "name", label: t("Ad") }]} />
          </div>
          <ul className="space-y-2">
            {list.map((c) => {
              const gap = c.last_log ? daysBetween(c.last_log, today) : null;
              const diff = c.avg_kcal_7 != null && c.kcal_target ? Math.round(((c.avg_kcal_7 - c.kcal_target) / c.kcal_target) * 100) : null;
              return (
                <li key={c.link_id}>
                  <Link href={`/dietitian/client?id=${c.link_id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">{c.name.slice(0, 1).toLocaleUpperCase("tr")}</span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate font-medium">
                        {c.name}
                        {needs(c) && (
                          <span className="flex shrink-0 items-center gap-1 rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-semibold text-warn">
                            <AlertCircle size={11} />
                            {gap == null ? t("7 gündür kayıt yok") : t("{n} gündür kayıt yok", { n: gap })}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {label(GOAL_LABELS, c.goal, lang) || "–"} · {t("7 günde {n} gün kayıt", { n: c.logged_days_7 })}
                        {c.avg_kcal_7 != null ? ` · ${t("ort.")} ${c.avg_kcal_7} kcal` : ""}
                        {diff != null ? ` (${diff > 0 ? "+" : ""}${diff}%)` : ""}
                      </p>
                      <p className="truncate text-[11px] text-muted">
                        {t("Bağlantı")}: {formatShort(c.since.slice(0, 10), lang)}
                        {c.last_note_at ? ` · ${t("son not")}: ${formatShort(c.last_note_at.slice(0, 10), lang)}` : ` · ${t("henüz not yok")}`}
                      </p>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <p className="mt-4 text-xs text-muted">{t("Yalnızca size bağlanan ve onay veren danışanların, izin verdikleri bölümleri görürsünüz. Danışan bağlantıyı sonlandırdığında erişiminiz ve notlarınız kaldırılır.")}</p>
    </div>
  );
}
