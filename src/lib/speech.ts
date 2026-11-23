"use client";

import { isNative } from "@/lib/native";

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

function ctor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechSupported(): boolean {
  // Yerel uygulamanın WebView'inde tarayıcı konuşma tanıma güvenilir değildir (mikrofon/konuşma
  // izni istenmeden ekran donabilir). Orada klavyenin kendi dikte (mikrofon) düğmesi kullanılır.
  if (isNative()) return false;
  return !!ctor();
}

/**
 * Tarayıcının konuşma tanımasını başlatır (Chrome, Edge, Safari). Ses, tarayıcının kendi
 * tanıma servisine gider; uygulama sunucusuna ses gönderilmez, yalnızca çıkan metin kullanılır.
 * Dönen fonksiyon dinlemeyi durdurur.
 */
export function listen(lang: "tr" | "en", on: { final: (text: string) => void; interim?: (text: string) => void; end: (error?: string) => void }): () => void {
  const SR = ctor();
  if (!SR) {
    on.end("unsupported");
    return () => {};
  }
  const rec = new SR();
  rec.lang = lang === "en" ? "en-US" : "tr-TR";
  rec.continuous = true;
  rec.interimResults = true;
  let error: string | undefined;
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) on.final(r[0].transcript.trim());
      else interim += r[0].transcript;
    }
    on.interim?.(interim.trim());
  };
  rec.onerror = (e) => {
    error = e.error;
  };
  rec.onend = () => on.end(error);
  try {
    rec.start();
  } catch {
    on.end("failed");
  }
  return () => {
    try {
      rec.stop();
    } catch {
      /* zaten durmuş */
    }
  };
}
