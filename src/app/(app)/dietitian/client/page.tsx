"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Trash2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { SharedReportView, type Shared } from "@/components/shared-report";
import { Button, Card, Empty, PageHeader, Segmented, Skeleton, Switch, Textarea } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { formatShort } from "@/lib/dates";

interface Note {
  id: string;
  content: string;
  visible_to_client: boolean;
  created_at: string;
}
interface Detail {
  report: Shared;
  notes: Note[];
  since: string;
  days: number;
}

function ClientInner() {
  const { t, lang, toast } = useApp();
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const [data, setData] = useState<Detail | null>(null);
  const [gone, setGone] = useState(false);
  const [note, setNote] = useState("");
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api<Detail>(`/api/dietitian/client/${id}?days=${days}`));
      setGone(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setGone(true);
    }
  }, [id, days]);
  useEffect(() => {
    void load();
  }, [load]);

  async function post(body: Record<string, unknown>, done: string) {
    setBusy(true);
    try {
      await api("/api/dietitian", { body });
      toast(done);
      await load();
      return true;
    } catch {
      toast(t("İşlem tamamlanamadı. Lütfen tekrar deneyin."), "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <Link href="/dietitian" aria-label={t("Geri")} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2">
      <ArrowLeft size={18} />
    </Link>
  );

  if (gone) {
    return (
      <div>
        <PageHeader title={t("Danışan")} back={back} />
        <Card>
          <Empty title={t("Bu danışana erişiminiz yok")} text={t("Bağlantı sonlandırılmış olabilir.")} />
        </Card>
      </div>
    );
  }
  if (!data) return <Skeleton className="h-72" />;
  const r = data.report;
  const s = r.sections;
  const dt = (iso: string) => new Date(iso).toLocaleString(lang === "en" ? "en-GB" : "tr-TR", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={[r.first_name, r.last_name].filter(Boolean).join(" ") || t("Danışan")} subtitle={`${formatShort(r.from, lang)} – ${formatShort(r.to, lang)} · ${t("Bağlantı")}: ${formatShort(data.since.slice(0, 10), lang)}`} back={back} />
      <Segmented className="mb-3" value={days} onChange={setDays} options={[{ value: "7", label: t("Son 7 gün") }, { value: "30", label: t("Son 30 gün") }, { value: "90", label: t("Son 90 gün") }]} />
      <p className="mb-4 text-xs text-muted">
        {t("Danışanın izin verdiği bölümler")}: {[t("günlük özetler"), s.meals && t("öğün ayrıntıları"), s.body && t("vücut ölçümleri"), s.wellbeing && t("uyku ve ruh hali")].filter(Boolean).join(", ")}
        {!s.meals || !s.body || !s.wellbeing ? ` · ${t("Paylaşılmayan")}: ${[!s.meals && t("öğün ayrıntıları"), !s.body && t("vücut ölçümleri"), !s.wellbeing && t("uyku ve ruh hali")].filter(Boolean).join(", ")}` : ""}
      </p>

      <Card className="mb-4 space-y-3">
        <h2 className="font-semibold">{t("Notlar")}</h2>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder={t("Öneri, hedef ya da bir sonraki görüşme için not yazın…")} aria-label={t("Yeni not")} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={visible} onChange={setVisible} label={t("Danışan da görsün")} />
            <span>{visible ? t("Danışan da görsün") : t("Yalnızca ben göreyim")}</span>
          </label>
          <Button
            loading={busy}
            disabled={!note.trim()}
            onClick={async () => {
              if (await post({ action: "note", link_id: id, content: note.trim(), visible_to_client: visible }, t("Not kaydedildi."))) setNote("");
            }}
          >
            {t("Notu kaydet")}
          </Button>
        </div>
        {data.notes.length > 0 && (
          <ul className="divide-y divide-border border-t border-border">
            {data.notes.map((n) => (
              <li key={n.id} className="flex items-start gap-3 py-2.5">
                <span className={`mt-0.5 shrink-0 ${n.visible_to_client ? "text-primary" : "text-muted"}`} title={n.visible_to_client ? t("Danışan görüyor") : t("Özel not")}>
                  {n.visible_to_client ? <Eye size={15} /> : <EyeOff size={15} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-sm">{n.content}</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {dt(n.created_at)} · {n.visible_to_client ? t("Danışan görüyor") : t("Özel not")}
                  </p>
                </div>
                <button type="button" aria-label={t("Notu sil")} onClick={() => confirm(t("Bu not silinsin mi?")) && post({ action: "note-delete", id: n.id }, t("Not silindi."))} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:text-danger">
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <SharedReportView data={r} lang={lang} />

      <div className="mt-6 border-t border-border pt-4">
        <Button
          variant="ghost"
          className="text-danger"
          onClick={async () => {
            if (!confirm(t("Bu danışanla bağlantı sonlandırılsın mı? Kayıtlarını artık göremezsiniz."))) return;
            if (await post({ action: "end", link_id: id }, t("Bağlantı sonlandırıldı."))) router.replace("/dietitian");
          }}
        >
          {t("Danışanla bağlantıyı sonlandır")}
        </Button>
      </div>
    </div>
  );
}

export default function DietitianClientPage() {
  return (
    <Suspense>
      <ClientInner />
    </Suspense>
  );
}
