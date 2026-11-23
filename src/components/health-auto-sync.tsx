"use client";
import { useEffect } from "react";
import { useApp } from "@/components/app-provider";
import { healthState } from "@/lib/health";
import { runHealthSync } from "@/lib/health-sync";
import { isNative } from "@/lib/native";

const MIN_GAP_MS = 15 * 60_000;

/** Bağlıysa uygulama açılırken ve öne gelirken (en az 15 dakikada bir) son 3 günü sessizce eşitler. */
export function HealthAutoSync() {
  const { profile, session } = useApp();
  const userId = session?.user.id;
  const weight = profile?.weight_kg;
  useEffect(() => {
    if (!isNative() || !userId) return;
    const tick = () => {
      const s = healthState();
      if (!s.connected) return;
      if (s.lastSync && Date.now() - new Date(s.lastSync).getTime() < MIN_GAP_MS) return;
      void runHealthSync(3, weight).catch(() => {});
    };
    tick();
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [userId, weight]);
  return null;
}
