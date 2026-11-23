"use client";
import { useEffect, useState } from "react";
import { Mail, Sparkles } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button, Card, Empty, PageHeader } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { addDays, formatDate, formatShort, toDateKey } from "@/lib/dates";
import { errorText } from "@/lib/errors";
import { supabase } from "@/lib/supabase/client";
import type { WeeklyLetter } from "@/lib/types";

export default function LetterPage() {
  const { t, lang, online, config, refreshConfig } = useApp();
  const [letters, setLetters] = useState<WeeklyLetter[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const today = toDateKey();

  useEffect(() => {
    supabase()
      .from("weekly_letters")
      .select("id, entry_date, content, created_at")
      .order("entry_date", { ascending: false })
      .limit(12)
      .then(({ data }) => setLetters((data ?? []) as WeeklyLetter[]));
  }, []);

  const current = letters?.find((l) => l.entry_date > addDays(today, -7));
  const older = (letters ?? []).filter((l) => l.id !== current?.id);
  const aiReady = online && config?.ai_available !== false;

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ letter: WeeklyLetter }>("/api/ai/weekly-letter", { body: { today, lang } });
      setLetters((cur) => [res.letter, ...(cur ?? []).filter((l) => l.id !== res.letter.id)]);
      void refreshConfig();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "";
      setError(code === "no_data" ? t("Bu hafta henüz kayıt yok. Birkaç gün kayıt girdikten sonra mektubunuzu oluşturabilirsiniz.") : errorText(code, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={t("Haftalık mektup")} subtitle={t("Bu hafta kendin için neler yaptın?")} />
      {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {!letters ? null : current ? (
        <Card>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary">
            <Mail size={14} />
            {formatDate(current.entry_date, lang, { day: "numeric", month: "long", year: "numeric" })}
          </p>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{current.content}</p>
          <p className="mt-3 text-xs text-muted">{t("Mektup haftada bir oluşturulur. Yenisi {d} tarihinden sonra hazırlanabilir.", { d: formatShort(addDays(current.entry_date, 7), lang) })}</p>
        </Card>
      ) : (
        <Card>
          <Empty
            icon={<Mail size={22} />}
            title={t("Bu haftanın mektubu henüz yazılmadı")}
            text={t("Son 7 günün kayıtlarınıza bakarak size özel kısa bir değerlendirme hazırlanır.")}
            action={
              <Button loading={busy} disabled={!aiReady} onClick={generate}>
                <Sparkles size={16} />
                {t("Mektubumu oluştur")}
              </Button>
            }
          />
          {!aiReady && <p className="text-center text-xs text-warn">{t("Mektup için bağlantı ve yapay zekâ servisi gerekir.")}</p>}
        </Card>
      )}
      {older.length > 0 && (
        <Card className="p-0">
          <p className="px-4 py-3 text-sm font-semibold">{t("Önceki mektuplar")}</p>
          <ul className="divide-y divide-border border-t border-border">
            {older.map((l) => (
              <li key={l.id}>
                <button type="button" aria-expanded={open === l.id} onClick={() => setOpen(open === l.id ? null : l.id)} className="w-full px-4 py-3 text-left">
                  <span className="text-sm font-medium">{formatDate(l.entry_date, lang, { day: "numeric", month: "long", year: "numeric" })}</span>
                  {open === l.id ? <span className="mt-2 block whitespace-pre-wrap text-sm leading-relaxed">{l.content}</span> : <span className="mt-0.5 block truncate text-xs text-muted">{l.content}</span>}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className="text-xs text-muted">{t("Mektup yapay zekâ tarafından kendi kayıtlarınıza dayanarak yazılır; tıbbi değerlendirme değildir.")}</p>
    </div>
  );
}
