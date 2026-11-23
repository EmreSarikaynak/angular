"use client";
import { useCallback, useEffect, useState } from "react";
import { Copy, Crown, LogOut, Plus, Users } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Bar, Button, Card, Chip, Empty, Field, Input, PageHeader, Select, Sheet, Skeleton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { formatShort } from "@/lib/dates";

type Metric = "logging" | "water" | "protein" | "steps";
interface Challenge {
  id: string;
  title: string;
  metric: Metric;
  days: number;
  start_date: string;
  end_date: string;
  finished: boolean;
  join_code: string;
  is_owner: boolean;
  members: { name: string; progress: number; me: boolean }[];
}

export default function ChallengesPage() {
  const { t, lang, profile, toast, online } = useApp();
  const [list, setList] = useState<Challenge[] | null>(null);
  const [sheet, setSheet] = useState<"create" | "join" | null>(null);
  const [title, setTitle] = useState("");
  const [metric, setMetric] = useState<Metric>("water");
  const [days, setDays] = useState(7);
  const [code, setCode] = useState("");
  const [name, setName] = useState(profile?.first_name ?? "");
  const [busy, setBusy] = useState(false);

  const metrics: Record<Metric, [string, string]> = {
    logging: [t("Her gün kayıt"), t("En az bir öğün kaydı girilen günler")],
    water: [t("Su hedefi"), t("Günlük su hedefine ulaşılan günler")],
    protein: [t("Protein hedefi"), t("Protein hedefinin en az %90'ına ulaşılan günler")],
    steps: [t("Adım hedefi"), t("Günlük adım hedefine ulaşılan günler")],
  };

  const load = useCallback(async () => {
    try {
      setList((await api<{ challenges: Challenge[] }>("/api/challenges")).challenges);
    } catch {
      setList((cur) => cur ?? []);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function send(body: Record<string, unknown>, done: string) {
    setBusy(true);
    try {
      setList((await api<{ challenges: Challenge[] }>("/api/challenges", { body })).challenges);
      setSheet(null);
      setCode("");
      setTitle("");
      toast(done);
    } catch (e) {
      const c = e instanceof ApiError ? e.code : "";
      toast(c === "challenge_not_found" ? t("Bu kodla etkin bir meydan okuma bulunamadı.") : c === "challenge_full" ? t("Bu meydan okuma dolu (en fazla 20 kişi).") : c === "too_many_challenges" ? t("Aynı anda en fazla 5 etkin meydan okumaya katılabilirsiniz.") : t("İşlem tamamlanamadı. Lütfen tekrar deneyin."), "error");
    } finally {
      setBusy(false);
    }
  }

  async function share(c: Challenge) {
    const text = t("BKNY'de “{title}” meydan okumama katıl! Kod: {code}", { title: c.title, code: c.join_code });
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

  const nameField = (
    <Field label={t("Görünen adınız")} hint={t("Diğer katılımcılar yalnızca bu adı ve tamamladığınız gün sayısını görür.")}>
      <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
    </Field>
  );

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("Meydan okumalar")} subtitle={t("Arkadaşlarınızla küçük ortak hedefler")} />
      <div className="mb-4 grid grid-cols-2 gap-2">
        <Button disabled={!online} onClick={() => setSheet("create")}>
          <Plus size={16} />
          {t("Yeni başlat")}
        </Button>
        <Button variant="secondary" disabled={!online} onClick={() => setSheet("join")}>
          <Users size={16} />
          {t("Kodla katıl")}
        </Button>
      </div>

      {!list ? (
        <Skeleton className="h-40" />
      ) : list.length === 0 ? (
        <Card>
          <Empty icon={<Users size={22} />} title={t("Henüz bir meydan okumanız yok")} text={t("Bir hedef seçip başlatın, kodu arkadaşlarınızla paylaşın. Sağlık kayıtlarınız paylaşılmaz; yalnızca kaç gün başardığınız görünür.")} />
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((c) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.title}</p>
                  <p className="text-xs text-muted">
                    {metrics[c.metric][0]} · {t("{n} gün", { n: c.days })} · {formatShort(c.start_date, lang)} – {formatShort(c.end_date, lang)}
                    {c.finished ? ` · ${t("bitti")}` : ""}
                  </p>
                </div>
                {!c.finished && (
                  <button type="button" onClick={() => share(c)} aria-label={t("Daveti paylaş")} className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold tracking-wider text-primary">
                    {c.join_code}
                    <Copy size={12} />
                  </button>
                )}
              </div>
              <ol className="mt-3 space-y-2">
                {c.members.map((m, i) => (
                  <li key={`${m.name}-${i}`}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className={`flex items-center gap-1.5 ${m.me ? "font-semibold" : ""}`}>
                        {i === 0 && m.progress > 0 && <Crown size={14} className="text-carbs" />}
                        {m.name}
                        {m.me && <span className="text-xs font-normal text-muted">({t("siz")})</span>}
                      </span>
                      <span className="text-muted">
                        {m.progress} / {c.days} {t("gün")}
                      </span>
                    </div>
                    <Bar value={m.progress} max={c.days} color={m.me ? "var(--primary)" : "var(--water)"} />
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={() => confirm(t("Bu meydan okumadan ayrılmak istiyor musunuz?")) && send({ action: "leave", id: c.id }, t("Meydan okumadan ayrıldınız."))}
                className="mt-3 flex items-center gap-1.5 text-xs text-muted"
              >
                <LogOut size={12} />
                {t("Ayrıl")}
              </button>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={sheet === "create"} onClose={() => setSheet(null)} title={t("Yeni meydan okuma")}>
        <div className="space-y-3">
          <Field label={t("Başlık")}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder={t("Örn. 7 gün su hedefi")} />
          </Field>
          <Field label={t("Hedef")} hint={metrics[metric][1]}>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(metrics) as Metric[]).map((m) => (
                <Chip key={m} active={metric === m} onClick={() => setMetric(m)}>
                  {metrics[m][0]}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label={t("Süre")}>
            <Select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={7}>{t("7 gün")}</option>
              <option value={14}>{t("14 gün")}</option>
              <option value={30}>{t("30 gün")}</option>
            </Select>
          </Field>
          {nameField}
          <Button size="lg" className="w-full" loading={busy} disabled={!title.trim() || !name.trim()} onClick={() => send({ action: "create", title: title.trim(), metric, days, display_name: name.trim() }, t("Meydan okuma başladı! Kodu arkadaşlarınızla paylaşın."))}>
            {t("Başlat")}
          </Button>
        </div>
      </Sheet>

      <Sheet open={sheet === "join"} onClose={() => setSheet(null)} title={t("Kodla katıl")}>
        <div className="space-y-3">
          <Field label={t("Katılım kodu")}>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))} placeholder="ABCD2345" autoCapitalize="characters" className="tracking-widest" />
          </Field>
          {nameField}
          <Button size="lg" className="w-full" loading={busy} disabled={code.length !== 8 || !name.trim()} onClick={() => send({ action: "join", code, display_name: name.trim() }, t("Meydan okumaya katıldınız!"))}>
            {t("Katıl")}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
