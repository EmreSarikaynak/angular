"use client";
import { useEffect, useState } from "react";
import { Activity, Check, Watch } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button, Switch } from "@/components/ui";
import { Collapsible } from "@/components/collapsible";
import { ALL_SCOPES, connectHealth, disconnectHealth, healthAvailable, healthState, openSystemHealthSettings, type HealthScope } from "@/lib/health";
import { runHealthSync } from "@/lib/health-sync";
import { isNative } from "@/lib/native";

/** Profil sayfasındaki "Saat ve sağlık verileri" kartı: izin, kapsam seçimi ve elle eşitleme. */
export function HealthConnectCard() {
  const { t, toast, profile } = useApp();
  const [native, setNative] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [state, setState] = useState(() => healthState());
  const [selected, setSelected] = useState<HealthScope[]>(["steps", "rings", "sleep", "workouts"]);
  const [busy, setBusy] = useState<"connect" | "sync" | null>(null);

  useEffect(() => {
    const n = isNative();
    setNative(n);
    const s = healthState();
    setState(s);
    if (s.scopes.length) setSelected(s.scopes);
    if (n) void healthAvailable().then((r) => setAvailable(r.available));
  }, []);

  const labels: Record<HealthScope, string> = {
    steps: t("Adım ve mesafe"),
    rings: t("Halkalar (hareket, egzersiz, ayakta)"),
    sleep: t("Uyku"),
    workouts: t("Antrenmanlar"),
    weight: t("Kilo"),
  };
  const lastSync = state.lastSync ? new Date(state.lastSync).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : null;

  if (!native) {
    return (
      <Collapsible title={t("Saat ve sağlık verileri")} icon={<Watch size={18} />}>
        <p className="text-sm text-muted">{t("Apple Watch, Galaxy Watch ve diğer saatlerin verileri, mobil uygulamada telefonunuzun sağlık deposundan (Apple Sağlık veya Health Connect) okunur. Bu özellik için BKNY mobil uygulamasını kullanın.")}</p>
      </Collapsible>
    );
  }

  async function connect(scopes: HealthScope[]) {
    if (!scopes.length) return toast(t("En az bir veri türü seçin."), "error");
    setBusy("connect");
    try {
      await connectHealth(scopes);
      setState(healthState());
      toast(t("Bağlandı. İlk eşitleme yapılıyor…"), "info");
      await sync();
    } catch {
      toast(t("İzin verilemedi. Sistem ayarlarından kontrol edin."), "error");
    } finally {
      setBusy(null);
    }
  }

  async function sync() {
    setBusy("sync");
    try {
      const r = await runHealthSync(7, profile?.weight_kg);
      setState(healthState());
      if (!r) return;
      const n = r.days + r.rings + r.activities + r.body;
      toast(n ? t("Eşitlendi: {d} gün, {a} antrenman.", { d: Math.max(r.days, r.rings), a: r.activities }) : t("Yeni veri yok."), n ? "ok" : "info");
      if (r.errors.length) toast(t("Bazı veriler okunamadı; izinleri kontrol edin."), "info");
    } catch {
      toast(t("Eşitlenemedi. İzinleri sistem ayarlarından kontrol edin."), "error");
    } finally {
      setBusy(null);
    }
  }

  function toggle(s: HealthScope, on: boolean) {
    const next = on ? [...selected, s] : selected.filter((x) => x !== s);
    setSelected(next);
    // Bağlıyken yeni açılan veri türü için izin yeniden istenir.
    if (state.connected && on) void connect(next);
  }

  return (
    <Collapsible title={t("Saat ve sağlık verileri")} icon={<Watch size={18} />}>
      <p className="text-sm text-muted">{t("BKNY, saatinizin telefona yazdığı verileri yalnızca okur: adım, halkalar, uyku, antrenman ve kilo. Reklam için kullanılmaz; istediğiniz zaman kapatabilirsiniz.")}</p>

      {available === false && <p className="rounded-xl bg-warn/10 px-3 py-2 text-sm text-warn">{t("Bu cihazda sağlık deposu bulunamadı. Android'de Health Connect uygulamasını Play Store'dan yükleyin.")}</p>}

      <ul className="space-y-2.5">
        {ALL_SCOPES.map((s) => (
          <li key={s} className="flex items-center justify-between gap-3">
            <span className="text-sm">{labels[s]}</span>
            <Switch checked={selected.includes(s)} onChange={(v) => toggle(s, v)} label={labels[s]} />
          </li>
        ))}
      </ul>

      {state.connected ? (
        <>
          <p className="flex items-center gap-2 text-xs text-muted">
            <Check size={14} className="text-primary" />
            {lastSync ? t("Son eşitleme: {time}", { time: lastSync }) : t("Henüz eşitlenmedi.")}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button loading={busy === "sync"} disabled={busy !== null} onClick={sync}>
              <Activity size={16} />
              {t("Şimdi eşitle")}
            </Button>
            <Button
              variant="secondary"
              disabled={busy !== null}
              onClick={() => {
                disconnectHealth();
                setState(healthState());
                toast(t("Bağlantı kaldırıldı. İzni sistem ayarlarından da kapatabilirsiniz."), "info");
              }}
            >
              {t("Bağlantıyı kaldır")}
            </Button>
          </div>
          <button type="button" onClick={() => void openSystemHealthSettings()} className="text-xs font-medium text-primary underline">
            {t("Sistem sağlık ayarlarını aç")}
          </button>
        </>
      ) : (
        <Button className="w-full" size="lg" loading={busy === "connect"} disabled={busy !== null || available === false} onClick={() => connect(selected)}>
          {t("Bağlan ve izin ver")}
        </Button>
      )}
      <p className="text-xs text-muted">{t("Apple Sağlık hangi izinleri verdiğinizi uygulamalara göstermez; veri gelmiyorsa Ayarlar › Sağlık › Veri Erişimi bölümünde BKNY'yi kontrol edin.")}</p>
    </Collapsible>
  );
}
