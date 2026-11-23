"use client";
import { supabase } from "./supabase/client";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

function toKey(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Bildirim izni ister ve (sunucuda VAPID anahtarı tanımlıysa) Web Push aboneliği oluşturur.
 * Dönen değer: "push" (sunucu bildirimi), "local" (yalnızca uygulama açıkken), "denied", "unsupported".
 */
export async function enableNotifications(): Promise<"push" | "local" | "denied" | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  if (!VAPID || !("PushManager" in window)) return "local";
  try {
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 3000))]);
    if (!reg) return "local";
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(VAPID) }));
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return "local";
    const { error } = await supabase()
      .from("push_subscriptions")
      .upsert({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent.slice(0, 200) }, { onConflict: "endpoint" });
    return error ? "local" : "push";
  } catch {
    return "local";
  }
}

export async function disableNotifications(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await supabase().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
  } catch {
    /* yoksay */
  }
}

/** Uygulama açıkken yerel bildirim (push yapılandırılmamışsa yedek). */
export async function showLocalNotification(title: string, body: string) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) await reg.showNotification(title, { body, icon: "/icons/icon-192.png", tag: "bkn-local" });
  else new Notification(title, { body, icon: "/icons/icon-192.png" });
}
