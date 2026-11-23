"use client";
import { useEffect } from "react";

/** Service worker kaydı (çevrimdışı kabuk + bildirimler). Geliştirme modunda kaydedilmez. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
