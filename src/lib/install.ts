"use client";
import { useEffect, useState } from "react";

/**
 * "Ana ekrana ekle" (PWA kurulumu). Android'de (Chrome/Edge/Samsung) tarayıcı `beforeinstallprompt` olayını verir ve
 * tek dokunuşla kurulum penceresi açılabilir. iOS'ta Apple programatik kuruluma izin vermez; yalnızca Paylaş menüsünden
 * "Ana Ekrana Ekle" ile yapılır, biz de adımları gösteririz.
 */
type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: PromptEvent | null = null;
let started = false;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

/** Olay sayfa açılırken bir kez gelir; bu yüzden kök bileşende erkenden dinlenir. */
export function initInstallCapture() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as PromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    try {
      localStorage.setItem("bt:installed", "1");
    } catch {}
    notify();
  });
}

export type Platform = "ios" | "android" | "desktop";

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

export function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Uygulama içi tarayıcılar (Instagram, Facebook vb.) "Ana Ekrana Ekle" sunmaz; Safari'de açmak gerekir. */
export function isInAppBrowser(): boolean {
  return /FBAN|FBAV|Instagram|Line\/|MicroMessenger|Twitter|Snapchat|TikTok/i.test(navigator.userAgent);
}

/** Tek dokunuşla kurulum penceresini açar; olay yoksa "unavailable" döner. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  const e = deferred;
  deferred = null;
  notify();
  await e.prompt();
  return (await e.userChoice).outcome;
}

export function useInstall() {
  const [state, setState] = useState({ platform: "desktop" as Platform, standalone: false, canPrompt: false, inApp: false, ready: false });
  useEffect(() => {
    initInstallCapture();
    const read = () => setState({ platform: detectPlatform(), standalone: isStandalone(), canPrompt: !!deferred, inApp: isInAppBrowser(), ready: true });
    read();
    subs.add(read);
    return () => {
      subs.delete(read);
    };
  }, []);
  return state;
}
