"use client";
import { useEffect } from "react";
import { isNative } from "@/lib/native";
import { inDailyWindow, toMinutes } from "@/lib/bkn/schedule";
import { useApp } from "./app-provider";
import { showLocalNotification } from "@/lib/push";
import { fetchAll, fetchRange } from "@/lib/data/store";
import { supplementNotice, waterNotice } from "@/lib/bkn/messages";
import { supplementSlots } from "@/lib/bkn/score";
import { toDateKey } from "@/lib/dates";
import type { Supplement, SupplementLog } from "@/lib/types";

/**
 * Sunucu bildirimi (Web Push) yapılandırılmamışsa, uygulama açıkken su ve takviye hatırlatmalarını
 * yerel olarak gösterir. Push etkinse sunucu zamanlayıcısı devreye girer ve bu bileşen çalışmaz.
 */
export function ReminderTicker() {
  const { profile, config, lang } = useApp();
  // Bu cihazda sunucu bildirimi yoksa (web: VAPID yok, uygulama: FCM yok) hatırlatmalar yerel gösterilir.
  const local = isNative() ? config?.fcm_available === false : config?.web_push_available === false;
  const water = local && !!profile?.reminder_enabled;
  const supps = local && !!profile?.notify_supplements;
  const interval = profile?.reminder_interval_min ?? 120;
  const start = toMinutes(profile?.reminder_start_hour ?? 9, profile?.reminder_start_minute ?? 0);
  const end = toMinutes(profile?.reminder_end_hour ?? 21, profile?.reminder_end_minute ?? 0);
  const target = profile?.water_target_ml ?? 2000;
  const nag = profile?.supplement_nag_min ?? 30;

  useEffect(() => {
    if (!water && !supps) return;
    const check = async () => {
      const now = new Date();
      const today = toDateKey();
      if (supps) {
        const [list, logs] = await Promise.all([
          fetchAll<Supplement & { [k: string]: unknown }>("supplements", "created_at").catch(() => []),
          fetchRange<SupplementLog & { [k: string]: unknown }>("supplement_logs", today, today).catch(() => []),
        ]);
        const nowMin = now.getHours() * 60 + now.getMinutes();
        for (const slot of supplementSlots(list, logs, today)) {
          if (slot.log) continue;
          const [h, m] = slot.time.split(":").map(Number);
          const elapsed = nowMin - (h * 60 + m);
          if (elapsed < 0 || elapsed > 180) continue;
          const attempt = nag > 0 ? Math.min(3, Math.floor(elapsed / nag)) : 0;
          const key = `bt:supp-notice:${slot.supplement.id}:${today}:${slot.time}:${attempt}`;
          if (localStorage.getItem(key)) continue;
          localStorage.setItem(key, "1");
          const n = supplementNotice(lang, slot.supplement.name, slot.supplement.dose, attempt);
          await showLocalNotification(n.title, n.body);
        }
      }
      if (water && inDailyWindow(now.getHours() * 60 + now.getMinutes(), start, end)) {
        const last = Number(localStorage.getItem("bt:last-reminder") ?? 0);
        if (!last) return localStorage.setItem("bt:last-reminder", String(Date.now()));
        if (Date.now() - last < interval * 60_000) return;
        localStorage.setItem("bt:last-reminder", String(Date.now()));
        const logs = await fetchRange<{ id: string; amount_ml: number }>("water_logs", today, today).catch(() => []);
        const total = logs.reduce((s, w) => s + Number(w.amount_ml), 0);
        if (total < target) {
          const n = waterNotice(lang, target - total, Math.floor(Date.now() / 1_800_000));
          await showLocalNotification(n.title, n.body);
        }
      }
    };
    const id = window.setInterval(check, 60_000);
    void check();
    return () => window.clearInterval(id);
  }, [water, supps, interval, start, end, target, nag, lang]);
  return null;
}
