"use client";
import { useEffect } from "react";
import { useApp } from "./app-provider";
import { showLocalNotification } from "@/lib/push";
import { fetchRange } from "@/lib/data/store";
import { toDateKey } from "@/lib/dates";

/**
 * Sunucu bildirimi (Web Push) yapılandırılmamışsa, uygulama açıkken su hatırlatmasını
 * yerel olarak gösterir. Push etkinse sunucu zamanlayıcısı devreye girer ve bu bileşen çalışmaz.
 */
export function ReminderTicker() {
  const { profile, config, t } = useApp();
  const enabled = !!profile?.reminder_enabled && config?.push_available === false;
  const interval = profile?.reminder_interval_min ?? 120;
  const start = profile?.reminder_start_hour ?? 9;
  const end = profile?.reminder_end_hour ?? 21;
  const target = profile?.water_target_ml ?? 2000;

  useEffect(() => {
    if (!enabled) return;
    const check = async () => {
      const hour = new Date().getHours();
      if (hour < start || hour >= end) return;
      const last = Number(localStorage.getItem("bt:last-reminder") ?? 0);
      if (!last) return localStorage.setItem("bt:last-reminder", String(Date.now()));
      if (Date.now() - last < interval * 60_000) return;
      localStorage.setItem("bt:last-reminder", String(Date.now()));
      const today = toDateKey();
      const logs = await fetchRange<{ id: string; amount_ml: number }>("water_logs", today, today).catch(() => []);
      const total = logs.reduce((s, w) => s + Number(w.amount_ml), 0);
      if (total < target) await showLocalNotification(t("Su içme zamanı 💧"), t("Bugünkü hedefine {n} ml kaldı.", { n: target - total }));
    };
    const id = window.setInterval(check, 60_000);
    void check();
    return () => window.clearInterval(id);
  }, [enabled, interval, start, end, target, t]);
  return null;
}
