"use client";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, ShieldAlert, Trash2, XCircle } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { BarSeries } from "@/components/charts";
import { Button, Card, Empty, Field, Input, NumberInput, PageHeader, Segmented, Skeleton, Stat, Switch } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { numberFmt } from "@/lib/i18n";

type Tab = "overview" | "users" | "ai" | "usage" | "errors";

interface Overview {
  overview: Record<string, number>;
  daily: { day: string; calls: number; cached_calls: number; errors: number; input_tokens: number; output_tokens: number; cost_usd: number }[];
  gemini_configured: boolean;
}
interface AdminUser {
  id: string;
  email: string | null;
  name: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
  onboarded: boolean;
  blocked: boolean;
  daily_ai_limit: number | null;
  is_admin: boolean;
  ai_calls_30d: number;
  ai_calls_today: number;
  ai_cost_30d: number;
}
interface Settings {
  ai_enabled: boolean;
  gemini_model: string;
  gemini_temperature: number;
  default_daily_ai_limit: number;
  premium_daily_ai_limit: number;
  per_minute_limit: number;
  price_input_per_m: number;
  price_output_per_m: number;
  cache_ttl_days: number;
  announcement: string;
}
interface Usage {
  daily: Overview["daily"];
  recent: { id: number; user_id: string | null; kind: string; model: string | null; input_tokens: number; output_tokens: number; cost_usd: number; cached: boolean; status: string; latency_ms: number | null; created_at: string }[];
  kinds: Record<string, { calls: number; cost: number }>;
}
interface ErrorRow {
  id: number;
  user_id: string | null;
  source: string;
  message: string;
  detail: unknown;
  created_at: string;
}

function useAdmin<T>(path: string, enabled: boolean) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.code : "server_error");
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);
  return { data, error, loading, reload: load };
}

function LimitInput({ value, onCommit }: { value: number | null; onCommit: (v: number | null) => void }) {
  const [v, setV] = useState<number | null>(value);
  return <NumberInput value={v} min={0} max={10000} onChange={setV} onBlur={() => v !== value && onCommit(v == null ? null : Math.round(v))} />;
}

export default function AdminPage() {
  const { t, lang, config, toast } = useApp();
  const [tab, setTab] = useState<Tab>("overview");
  const isAdmin = !!config?.is_admin;
  const nf = (n: number, d = 0) => numberFmt(lang, n, d);
  const usd = (n: number) => `$${Number(n).toFixed(n < 1 ? 4 : 2)}`;
  const dt = (s: string | null) => (s ? new Date(s).toLocaleString(lang === "en" ? "en-GB" : "tr-TR", { dateStyle: "short", timeStyle: "short" }) : "–");

  const overview = useAdmin<Overview>("/api/admin/overview", isAdmin && tab === "overview");
  const users = useAdmin<{ users: AdminUser[]; self_id: string }>("/api/admin/users", isAdmin && tab === "users");
  const settings = useAdmin<{ settings: Settings; gemini_configured: boolean; base_url_overridden: boolean }>("/api/admin/settings", isAdmin && tab === "ai");
  const usage = useAdmin<Usage>("/api/admin/usage", isAdmin && tab === "usage");
  const errors = useAdmin<{ errors: ErrorRow[] }>("/api/admin/errors", isAdmin && tab === "errors");

  const [form, setForm] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; model?: string; latency_ms?: number; error?: string; detail?: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (settings.data) setForm(settings.data.settings);
  }, [settings.data]);

  if (!config) return <Skeleton className="h-64" />;
  if (!isAdmin) {
    return (
      <Card>
        <Empty icon={<ShieldAlert size={22} />} title={t("Bu sayfa için yetkiniz yok")} text={t("Yönetim paneline yalnızca yöneticiler erişebilir.")} />
      </Card>
    );
  }

  async function post(action: string, body: unknown, done?: () => void) {
    try {
      await api(`/api/admin/${action}`, { body });
      toast(t("Kaydedildi."));
      done?.();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "";
      toast(code === "cannot_demote_self" || code === "cannot_delete_self" ? t("Bu işlemi kendi hesabınızda yapamazsınız.") : t("İşlem başarısız oldu."), "error");
    }
  }

  async function saveSettings() {
    if (!form) return;
    setSaving(true);
    try {
      const res = await api<{ settings: Settings }>("/api/admin/settings", { body: form });
      setForm(res.settings);
      toast(t("Ayarlar kaydedildi."));
    } catch {
      toast(t("Ayarlar kaydedilemedi. Değerleri kontrol edin."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTest(null);
    try {
      setTest(await api("/api/admin/test-ai", { body: {} }));
    } catch {
      setTest({ ok: false, error: "server_error" });
    } finally {
      setTesting(false);
    }
  }

  const o = overview.data?.overview;
  const filtered = (users.data?.users ?? []).filter((u) => !query.trim() || `${u.email} ${u.name}`.toLowerCase().includes(query.trim().toLowerCase()));
  const refresh = (r: { reload: () => void; loading: boolean }) => (
    <button type="button" onClick={r.reload} aria-label={t("Yenile")} className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-muted">
      <RefreshCw size={16} className={r.loading ? "animate-spin" : ""} />
    </button>
  );
  const failed = (e: string | null) => e && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{t("Veriler yüklenemedi.")}</p>;

  return (
    <div>
      <PageHeader title={t("Yönetim paneli")} subtitle={t("Kişisel sağlık kayıtları bu panelde görüntülenmez.")} />
      <Segmented<Tab>
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: t("Genel") },
          { value: "users", label: t("Kullanıcılar") },
          { value: "ai", label: t("Ayarlar") },
          { value: "usage", label: t("Kullanım") },
          { value: "errors", label: t("Hatalar") },
        ]}
      />

      {tab === "overview" && (
        <div className="space-y-4">
          {failed(overview.error)}
          {!o ? (
            <Skeleton className="h-48" />
          ) : (
            <>
              <Card>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold">{t("Genel kullanım istatistikleri")}</h2>
                  {refresh(overview)}
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Stat label={t("Toplam kullanıcı")} value={nf(o.users_total)} />
                  <Stat label={t("Profilini tamamlayan")} value={nf(o.users_onboarded)} />
                  <Stat label={t("Son 7 günde yeni")} value={nf(o.users_new_7d)} />
                  <Stat label={t("Son 7 günde aktif")} value={nf(o.active_users_7d)} />
                  <Stat label={t("Yiyecek kaydı (toplam)")} value={nf(o.food_entries_total)} />
                  <Stat label={t("Yiyecek kaydı (7 gün)")} value={nf(o.food_entries_7d)} />
                  <Stat label={t("Fotoğraflı kayıt")} value={nf(o.photo_entries_total)} />
                  <Stat label={t("Su / aktivite kaydı")} value={`${nf(o.water_logs_total)} / ${nf(o.activities_total)}`} />
                  <Stat label={t("YZ çağrısı (bugün)")} value={nf(o.ai_calls_today)} />
                  <Stat label={t("YZ çağrısı (30 gün)")} value={nf(o.ai_calls_30d)} />
                  <Stat label={t("Tahmini maliyet (30 gün)")} value={usd(o.ai_cost_30d)} />
                  <Stat label={t("Hata (24 saat)")} value={nf(o.errors_24h)} color={o.errors_24h > 0 ? "var(--danger)" : undefined} />
                </div>
              </Card>
              <Card>
                <h2 className="mb-2 font-semibold">{t("Günlük YZ çağrıları (30 gün)")}</h2>
                {overview.data!.daily.length === 0 ? <Empty title={t("Henüz YZ çağrısı yok")} /> : <BarSeries data={overview.data!.daily.map((d) => ({ label: d.day.slice(5), value: Number(d.calls) }))} unit="" />}
              </Card>
              {!overview.data!.gemini_configured && <p className="rounded-xl bg-warn/10 px-3 py-2.5 text-sm text-warn">{t("GEMINI_API_KEY sunucuda tanımlı değil; yapay zekâ özellikleri kapalı.")}</p>}
            </>
          )}
        </div>
      )}

      {tab === "users" && (
        <div className="space-y-3">
          {failed(users.error)}
          <div className="flex gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("E-posta veya ad ara")} />
            {refresh(users)}
          </div>
          {!users.data ? (
            <Skeleton className="h-48" />
          ) : filtered.length === 0 ? (
            <Card>
              <Empty title={t("Kullanıcı bulunamadı")} />
            </Card>
          ) : (
            filtered.map((u) => (
              <Card key={u.id} className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {u.email}
                      {u.is_admin && <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">{t("Yönetici")}</span>}
                      {u.blocked && <span className="ml-2 rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-semibold text-danger">{t("Engelli")}</span>}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {u.name || "–"} · {t("Kayıt")}: {dt(u.created_at)} · {t("Son giriş")}: {dt(u.last_sign_in_at)}
                    </p>
                    <p className="text-xs text-muted">
                      {t("YZ")}: {t("bugün")} {u.ai_calls_today} · 30 {t("gün")} {u.ai_calls_30d} · {usd(u.ai_cost_30d)}
                      {!u.onboarded && ` · ${t("profil tamamlanmadı")}`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <Field label={t("Günlük YZ limiti")} hint={t("Boş = varsayılan")} className="w-36">
                    <LimitInput value={u.daily_ai_limit} onCommit={(v) => post("user-update", { user_id: u.id, daily_ai_limit: v }, users.reload)} />
                  </Field>
                  <Button size="sm" variant="secondary" onClick={() => post("user-update", { user_id: u.id, blocked: !u.blocked }, users.reload)}>
                    {u.blocked ? t("Engeli kaldır") : t("YZ erişimini engelle")}
                  </Button>
                  <Button size="sm" variant="secondary" disabled={u.id === users.data!.self_id && u.is_admin} onClick={() => post("user-update", { user_id: u.id, is_admin: !u.is_admin }, users.reload)}>
                    {u.is_admin ? t("Yöneticiliği kaldır") : t("Yönetici yap")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    disabled={u.id === users.data!.self_id}
                    onClick={() => confirm(t("{email} hesabı ve tüm verileri kalıcı olarak silinsin mi?", { email: u.email ?? u.id })) && post("user-delete", { user_id: u.id }, users.reload)}
                  >
                    <Trash2 size={15} />
                    {t("Sil")}
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === "ai" && (
        <div className="space-y-4">
          {failed(settings.error)}
          {!form || !settings.data ? (
            <Skeleton className="h-64" />
          ) : (
            <>
              <Card className="space-y-3">
                <h2 className="font-semibold">{t("Gemini API ayarları")}</h2>
                <p className={`flex items-center gap-2 text-sm ${settings.data.gemini_configured ? "text-primary" : "text-danger"}`}>
                  {settings.data.gemini_configured ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  {settings.data.gemini_configured ? t("API anahtarı sunucuda tanımlı (güvenlik nedeniyle burada gösterilmez).") : t("API anahtarı tanımlı değil. Sunucu ortam değişkeni GEMINI_API_KEY olarak ekleyin.")}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{t("Yapay zekâ özellikleri açık")}</span>
                  <Switch checked={form.ai_enabled} onChange={(v) => setForm({ ...form, ai_enabled: v })} label={t("Yapay zekâ özellikleri açık")} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t("Model")} hint={t("Görsel girdi ve yapılandırılmış JSON çıktısı destekleyen bir Gemini modeli.")}>
                    <Input value={form.gemini_model} onChange={(e) => setForm({ ...form, gemini_model: e.target.value.trim() })} maxLength={80} />
                  </Field>
                  <Field label={t("Sıcaklık (0–1)")}>
                    <NumberInput value={form.gemini_temperature} onChange={(v) => setForm({ ...form, gemini_temperature: v ?? 0 })} min={0} max={1} step="0.1" />
                  </Field>
                  <Field label={t("Girdi fiyatı (USD / 1M belirteç)")}>
                    <NumberInput value={form.price_input_per_m} onChange={(v) => setForm({ ...form, price_input_per_m: v ?? 0 })} min={0} step="0.01" />
                  </Field>
                  <Field label={t("Çıktı fiyatı (USD / 1M belirteç)")}>
                    <NumberInput value={form.price_output_per_m} onChange={(v) => setForm({ ...form, price_output_per_m: v ?? 0 })} min={0} step="0.01" />
                  </Field>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" loading={testing} onClick={runTest}>
                    {t("Bağlantıyı test et")}
                  </Button>
                  {test && (
                    <span className={`text-sm ${test.ok ? "text-primary" : "text-danger"}`}>
                      {test.ok ? t("Başarılı · {model} · {ms} ms", { model: test.model ?? "", ms: test.latency_ms ?? 0 }) : `${t("Başarısız")}: ${test.error}${test.detail ? ` — ${test.detail}` : ""}`}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted">{t("Test, kaydedilmiş model ayarıyla yapılır; modeli değiştirdiyseniz önce kaydedin.")}</p>
              </Card>

              <Card className="space-y-3">
                <h2 className="font-semibold">{t("Kullanıcı sorgu limitleri")}</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label={t("Günlük sorgu limiti (kullanıcı başına)")}>
                    <NumberInput value={form.default_daily_ai_limit} onChange={(v) => setForm({ ...form, default_daily_ai_limit: Math.round(v ?? 0) })} min={0} max={10000} />
                  </Field>
                  <Field label={t("Premium günlük sorgu limiti")}>
                    <NumberInput value={form.premium_daily_ai_limit} onChange={(v) => setForm({ ...form, premium_daily_ai_limit: Math.round(v ?? 0) })} min={0} max={10000} />
                  </Field>
                  <Field label={t("Dakikalık istek limiti")}>
                    <NumberInput value={form.per_minute_limit} onChange={(v) => setForm({ ...form, per_minute_limit: Math.round(v ?? 1) })} min={1} max={120} />
                  </Field>
                  <Field label={t("Önbellek süresi (gün)")} hint={t("0 = önbellek kapalı")}>
                    <NumberInput value={form.cache_ttl_days} onChange={(v) => setForm({ ...form, cache_ttl_days: Math.round(v ?? 0) })} min={0} max={365} />
                  </Field>
                </div>
                <Button variant="secondary" size="sm" onClick={() => confirm(t("Yapay zekâ önbelleği temizlensin mi?")) && post("cache-clear", {})}>
                  {t("Önbelleği temizle")}
                </Button>
              </Card>

              <Card className="space-y-3">
                <h2 className="font-semibold">{t("Uygulama ayarları")}</h2>
                <Field label={t("Duyuru metni")} hint={t("Tüm kullanıcılara ekranın üstünde gösterilir. Boş bırakırsanız gösterilmez.")}>
                  <Input value={form.announcement} onChange={(e) => setForm({ ...form, announcement: e.target.value })} maxLength={300} />
                </Field>
              </Card>

              <Button size="lg" className="w-full sm:w-auto" loading={saving} onClick={saveSettings}>
                {t("Ayarları kaydet")}
              </Button>
            </>
          )}
        </div>
      )}

      {tab === "usage" && (
        <div className="space-y-4">
          {failed(usage.error)}
          {!usage.data ? (
            <Skeleton className="h-64" />
          ) : (
            <>
              <Card>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-semibold">{t("Tahmini maliyet (30 gün, USD)")}</h2>
                  {refresh(usage)}
                </div>
                {usage.data.daily.length === 0 ? <Empty title={t("Henüz YZ çağrısı yok")} /> : <BarSeries data={usage.data.daily.map((d) => ({ label: d.day.slice(5), value: Number(d.cost_usd) }))} unit="USD" color="var(--carbs)" />}
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label={t("Çağrı")} value={nf(usage.data.daily.reduce((s, d) => s + Number(d.calls), 0))} />
                  <Stat label={t("Önbellekten")} value={nf(usage.data.daily.reduce((s, d) => s + Number(d.cached_calls), 0))} />
                  <Stat label={t("Girdi / çıktı belirteci")} value={`${nf(usage.data.daily.reduce((s, d) => s + Number(d.input_tokens), 0))} / ${nf(usage.data.daily.reduce((s, d) => s + Number(d.output_tokens), 0))}`} />
                  <Stat label={t("Toplam maliyet")} value={usd(usage.data.daily.reduce((s, d) => s + Number(d.cost_usd), 0))} />
                </div>
              </Card>
              <Card>
                <h2 className="mb-2 font-semibold">{t("Türe göre (30 gün)")}</h2>
                <ul className="divide-y divide-border text-sm">
                  {Object.entries(usage.data.kinds).map(([k, v]) => (
                    <li key={k} className="flex justify-between py-1.5">
                      <span>{k}</span>
                      <span className="text-muted">
                        {nf(v.calls)} · {usd(v.cost)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="overflow-x-auto p-0">
                <h2 className="px-4 py-3 font-semibold">{t("Son çağrılar")}</h2>
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="border-y border-border text-muted">
                    <tr>
                      {[t("Zaman"), t("Tür"), t("Model"), t("Belirteç (g/ç)"), t("Maliyet"), t("Süre"), t("Durum")].map((h) => (
                        <th key={h} className="px-3 py-2 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {usage.data.recent.map((r) => (
                      <tr key={r.id}>
                        <td className="px-3 py-2">{dt(r.created_at)}</td>
                        <td className="px-3 py-2">{r.kind}</td>
                        <td className="px-3 py-2">{r.model ?? "–"}</td>
                        <td className="px-3 py-2">
                          {nf(r.input_tokens)} / {nf(r.output_tokens)}
                        </td>
                        <td className="px-3 py-2">{usd(r.cost_usd)}</td>
                        <td className="px-3 py-2">{r.latency_ms != null ? `${r.latency_ms} ms` : "–"}</td>
                        <td className={`px-3 py-2 font-medium ${r.status === "ok" ? "" : "text-danger"}`}>{r.cached ? t("önbellek") : r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </div>
      )}

      {tab === "errors" && (
        <div className="space-y-3">
          {failed(errors.error)}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t("Sistem hata kayıtları")}</h2>
            <div className="flex gap-2">
              {refresh(errors)}
              <Button size="sm" variant="secondary" onClick={() => confirm(t("Tüm hata kayıtları silinsin mi?")) && post("errors-clear", {}, errors.reload)}>
                {t("Temizle")}
              </Button>
            </div>
          </div>
          {!errors.data ? (
            <Skeleton className="h-48" />
          ) : errors.data.errors.length === 0 ? (
            <Card>
              <Empty icon={<CheckCircle2 size={22} />} title={t("Kayıtlı hata yok")} />
            </Card>
          ) : (
            errors.data.errors.map((e) => (
              <Card key={e.id} className="p-3">
                <p className="flex items-center justify-between gap-2 text-xs text-muted">
                  <span className="font-semibold text-danger">{e.source}</span>
                  <span>{dt(e.created_at)}</span>
                </p>
                <p className="mt-1 break-words text-sm">{e.message}</p>
                {e.detail != null && <pre className="mt-1 overflow-x-auto rounded-lg bg-surface-2 p-2 text-[11px] text-muted">{JSON.stringify(e.detail)}</pre>}
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
