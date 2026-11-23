"use client";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { api } from "./api";
import { isNative } from "./native";

/**
 * Mobil uygulama bildirimleri (Firebase Cloud Messaging; iOS'ta APNs, FCM üzerinden).
 * Eklenti yalnızca yerel kabukta bulunur; web sürümünde bu modül hiçbir çağrı yapmaz.
 * Uygulama uzak adresten yüklendiği için eklenti, @capacitor/core'un registerPlugin'i ile çağrılır.
 */
interface Handle {
  remove(): Promise<void>;
}
interface MessagingPlugin {
  checkPermissions(): Promise<{ receive: "prompt" | "prompt-with-rationale" | "granted" | "denied" }>;
  requestPermissions(): Promise<{ receive: "prompt" | "prompt-with-rationale" | "granted" | "denied" }>;
  getToken(): Promise<{ token: string }>;
  deleteToken(): Promise<void>;
  createChannel(options: { id: string; name: string; description?: string; importance: 1 | 2 | 3 | 4 | 5; visibility?: -1 | 0 | 1; vibration?: boolean; lights?: boolean; lightColor?: string }): Promise<void>;
  addListener(event: "tokenReceived", fn: (e: { token: string }) => void): Promise<Handle>;
  addListener(event: "notificationActionPerformed", fn: (e: { notification?: { data?: unknown } }) => void): Promise<Handle>;
}

const Messaging = registerPlugin<MessagingPlugin>("FirebaseMessaging");
const platform = () => (Capacitor.getPlatform() === "ios" ? "ios" : "android");
const KEY = "bt:fcm-token";

async function register(token: string) {
  await api("/api/devices", { body: { token, platform: platform() } });
  try {
    localStorage.setItem(KEY, token);
  } catch {
    /* yoksay */
  }
}

async function ensureChannel() {
  if (Capacitor.getPlatform() !== "android") return;
  // Android 8+: "Hatırlatmalar" bildirim kanalı (sunucu gönderimindeki channel_id ile aynı).
  // Kanal ayarları kanal oluşturulduktan sonra değişmez; bu yüzden ayar değişince yeni kimlik (v2) kullanılır.
  // Önem 5: sesli, titreşimli, ekranın üstünde açılan (heads-up) bildirim.
  await Messaging.createChannel({ id: "bkn_reminders_v2", name: "Hatırlatmalar", description: "Su, takviye ve hedef hatırlatmaları", importance: 5, visibility: 1, vibration: true, lights: true, lightColor: "#1F9D76" }).catch(() => {});
}

/** İzin ister, belirteci alıp sunucuya kaydeder. */
export async function nativePushEnable(): Promise<"push" | "denied" | "unsupported"> {
  if (!isNative()) return "unsupported";
  try {
    const perm = await Messaging.requestPermissions();
    if (perm.receive !== "granted") return "denied";
    await ensureChannel();
    await register((await Messaging.getToken()).token);
    return "push";
  } catch {
    // Eklenti bu uygulama sürümünde yoksa ya da Firebase yapılandırması eksikse.
    return "unsupported";
  }
}

/** Açılışta: izin zaten verilmişse belirteci sessizce yeniler (belirteç zamanla değişebilir). */
export async function nativePushRefresh(): Promise<void> {
  if (!isNative()) return;
  try {
    if ((await Messaging.checkPermissions()).receive !== "granted") return;
    await ensureChannel();
    await register((await Messaging.getToken()).token);
  } catch {
    /* yoksay */
  }
}

/** Bildirimleri kapatırken ya da çıkış yaparken bu cihazın belirtecini sunucudan siler. */
export async function nativePushDisable(): Promise<void> {
  if (!isNative()) return;
  try {
    const token = localStorage.getItem(KEY) ?? (await Messaging.getToken()).token;
    await api("/api/devices", { method: "DELETE", body: { token } });
    localStorage.removeItem(KEY);
    await Messaging.deleteToken();
  } catch {
    /* yoksay */
  }
}

/** Belirteç yenilenince sunucuya bildirir; bildirime dokunulunca uygulamada ilgili sayfayı açar. */
export async function nativePushListen(): Promise<() => void> {
  if (!isNative()) return () => {};
  const handles: Handle[] = [];
  try {
    handles.push(await Messaging.addListener("tokenReceived", (e) => void register(e.token).catch(() => {})));
    handles.push(
      await Messaging.addListener("notificationActionPerformed", (e) => {
        const url = (e.notification?.data as { url?: unknown } | undefined)?.url;
        // Yalnızca uygulama içi yollar; dışarıdan gelen bir adrese yönlendirme yapılmaz.
        if (typeof url === "string" && /^\/[A-Za-z0-9/_?=&.-]*$/.test(url) && !url.startsWith("//")) window.location.assign(url);
      }),
    );
  } catch {
    /* eklenti yok */
  }
  return () => handles.forEach((h) => void h.remove().catch(() => {}));
}
