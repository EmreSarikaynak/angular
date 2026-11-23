"use client";
import { useEffect } from "react";
import { useApp } from "./app-provider";
import { isNative } from "@/lib/native";
import { nativePushListen, nativePushRefresh } from "@/lib/native-push";

/** Mobil uygulamada: bildirime dokunmayı dinler ve cihaz belirtecini güncel tutar. Web'de hiçbir şey yapmaz. */
export function NativePush() {
  const { session, config } = useApp();
  const userId = session?.user.id;
  const ready = !!config?.fcm_available;

  useEffect(() => {
    if (!isNative() || !userId) return;
    let off: (() => void) | undefined;
    let cancelled = false;
    void nativePushListen().then((fn) => (cancelled ? fn() : (off = fn)));
    return () => {
      cancelled = true;
      off?.();
    };
  }, [userId]);

  useEffect(() => {
    if (isNative() && userId && ready) void nativePushRefresh();
  }, [userId, ready]);

  return null;
}
