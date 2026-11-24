"use client";
import { useEffect, useState } from "react";
import { Watch } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button, Sheet } from "@/components/ui";
import { connectHealth, healthAvailable, healthState, type HealthScope } from "@/lib/health";
import { runHealthSync } from "@/lib/health-sync";
import { isNative } from "@/lib/native";

const ASKED = "bt:health-asked";
const DEFAULT_SCOPES: HealthScope[] = ["steps", "rings", "sleep", "workouts"];

/**
 * Mobil uygulamada ilk açılışta (profil tamamlandıktan sonra) saat ve sağlık verilerini tek dokunuşla bağlamayı önerir.
 * Sistem izin penceresi (Apple Sağlık / Health Connect) güvenlik gereği her zaman gösterilir; burada yalnızca neden istendiği anlatılır.
 */
export function HealthPrompt() {
  const { t, toast, profile } = useApp();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isNative() || !profile?.onboarded_at) return;
    let asked = false;
    try {
      asked = !!localStorage.getItem(ASKED);
    } catch {}
    if (asked || healthState().connected) return;
    void healthAvailable().then((r) => r.available && setOpen(true));
  }, [profile?.onboarded_at]);

  const later = () => {
    try {
      localStorage.setItem(ASKED, "1");
    } catch {}
    setOpen(false);
  };

  async function connect() {
    setBusy(true);
    try {
      await connectHealth(DEFAULT_SCOPES);
      try {
        localStorage.setItem(ASKED, "1");
      } catch {}
      setOpen(false);
      toast(t("Bağlandı. İlk eşitleme yapılıyor…"), "info");
      const r = await runHealthSync(7, profile?.weight_kg);
      if (r) toast(r.days + r.rings + r.activities + r.body ? t("Eşitlendi: {d} gün, {a} antrenman.", { d: Math.max(r.days, r.rings), a: r.activities }) : t("Yeni veri yok."), "ok");
    } catch {
      toast(t("İzin verilemedi. Sistem ayarlarından kontrol edin."), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={later}
      title={t("Saat verilerini bağla")}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" disabled={busy} onClick={later}>
            {t("Şimdi değil")}
          </Button>
          <Button className="flex-1" loading={busy} onClick={connect}>
            {t("Bağla")}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
          <Watch size={22} />
        </span>
        <div className="space-y-2 text-sm">
          <p className="font-semibold">{t("Adım, uyku, halka ve antrenmanların otomatik eklensin mi?")}</p>
          <p className="text-muted">{t("BKNY, saatinizin telefona yazdığı verileri yalnızca okur ve günlüğünüze ekler. Reklam için kullanılmaz. Sonraki adımda telefonun izin penceresi açılır; istediğiniz zaman Profil'den kapatabilirsiniz.")}</p>
        </div>
      </div>
    </Sheet>
  );
}
