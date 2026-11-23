"use client";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Trash2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button, PageHeader, cx } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { toDateKey } from "@/lib/dates";
import { errorText } from "@/lib/errors";
import { supabase } from "@/lib/supabase/client";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export default function AssistantPage() {
  const { t, lang, online, config, refreshConfig, toast, session } = useApp();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    supabase()
      .from("chat_messages")
      .select("role, content, created_at")
      .order("created_at", { ascending: false })
      .limit(40)
      .then(({ data }) => {
        if (data) setMessages((cur) => (cur.length ? cur : (data.reverse() as Msg[])));
      });
  }, [userId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  const suggestions = [
    t("Bugün ne kadar kalori aldım?"),
    t("Akşam ne yiyebilirim?"),
    t("Bugün yeterince protein aldım mı?"),
    t("Bu hafta hedeflerime ne kadar yaklaştım?"),
    t("En fazla kaloriyi hangi yiyeceklerden alıyorum?"),
    t("Su tüketimim yeterli mi?"),
    t("Kilo değişimim nasıl ilerliyor?"),
  ];
  const available = online && config?.ai_available !== false;

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setError(null);
    setInput("");
    const history = messages.slice(-10);
    setMessages((m) => [...m, { role: "user", content: message }]);
    setBusy(true);
    try {
      const res = await api<{ reply: string }>("/api/ai/assistant", { body: { message, history, lang, today: toDateKey() } });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
      void refreshConfig();
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : "", t));
      setMessages((m) => m.slice(0, -1));
      setInput(message);
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    if (!userId || !confirm(t("Sohbet geçmişi silinsin mi?"))) return;
    const { error: err } = await supabase().from("chat_messages").delete().eq("user_id", userId);
    if (err) return toast(t("Silinemedi."), "error");
    setMessages([]);
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-9rem)] max-w-2xl flex-col lg:min-h-[calc(100dvh-5rem)]">
      <PageHeader
        title={t("Asistan")}
        subtitle={config ? t("Bugün kalan sorgu: {n}", { n: config.quota.remaining }) : undefined}
        action={
          messages.length > 0 ? (
            <button type="button" onClick={clear} aria-label={t("Sohbeti temizle")} className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-muted">
              <Trash2 size={16} />
            </button>
          ) : undefined
        }
      />

      <div className="flex-1 space-y-3">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="flex items-center gap-2 font-semibold">
              <Sparkles size={18} className="text-primary" />
              {t("Kayıtlarınıza dayalı kişisel asistan")}
            </p>
            <p className="mt-1 text-sm text-muted">{t("Sorularınızı kendi beslenme, su, aktivite ve kilo kayıtlarınıza bakarak yanıtlar.")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button key={s} type="button" disabled={!available || busy} onClick={() => send(s)} className="rounded-full border border-border bg-surface px-3 py-1.5 text-left text-sm disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cx("max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed", m.role === "user" ? "rounded-br-md bg-primary text-white" : "rounded-bl-md border border-border bg-surface")}>{m.content}</div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3 text-sm text-muted">{t("Yazıyor…")}</div>
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {!available && <p className="rounded-xl bg-warn/10 px-3 py-2 text-sm text-warn">{!online ? t("Asistan için internet bağlantısı gerekir.") : t("Yapay zekâ servisi şu anda kullanılamıyor.")}</p>}
        <div ref={endRef} />
      </div>

      <form
        className="sticky bottom-20 mt-4 flex gap-2 rounded-2xl border border-border bg-surface p-2 shadow-sm lg:bottom-4"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={1500} placeholder={t("Bir soru yazın…")} aria-label={t("Mesaj")} className="h-11 min-w-0 flex-1 bg-transparent px-2 focus:outline-none" />
        <Button type="submit" disabled={!input.trim() || !available} loading={busy} aria-label={t("Gönder")} className="w-11 shrink-0 px-0">
          {!busy && <Send size={18} />}
        </Button>
      </form>
      <p className="mt-2 text-center text-[11px] text-muted">{t("Asistan tıbbi teşhis koymaz ve tedavi önermez. Sağlık sorunlarınız için hekiminize danışın.")}</p>
    </div>
  );
}
