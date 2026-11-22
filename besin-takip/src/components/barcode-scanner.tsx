"use client";
import { useEffect, useRef, useState } from "react";
import { useApp } from "./app-provider";

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

/**
 * Kamera ile barkod okuma. Tarayıcı BarcodeDetector API'sini destekliyorsa onu,
 * desteklemiyorsa (ör. iOS Safari) ZXing kütüphanesini kullanır.
 */
export function BarcodeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const { t } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const cb = useRef(onDetected);
  useEffect(() => {
    cb.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let stopZxing: (() => void) | null = null;
    let raf = 0;
    const video = videoRef.current;

    const found = (code: string) => {
      if (stopped || !/^\d{8,14}$/.test(code)) return;
      stopped = true;
      cb.current(code);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia || !video) return setError(t("Bu cihazda kamera kullanılamıyor. Barkod numarasını elle girin."));
      try {
        const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
        if (Native) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
          if (stopped) return stream.getTracks().forEach((tr) => tr.stop());
          video.srcObject = stream;
          await video.play();
          const detector = new Native({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
          const tick = async () => {
            if (stopped) return;
            try {
              const codes = await detector.detect(video);
              if (codes[0]) found(codes[0].rawValue);
            } catch {
              /* kare okunamadı, devam */
            }
            raf = window.setTimeout(tick, 250);
          };
          void tick();
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } }, audio: false }, video, (result) => {
            if (result) found(result.getText());
          });
          stopZxing = () => controls.stop();
          if (stopped) controls.stop();
        }
      } catch {
        setError(t("Kameraya erişilemedi. İzin verin veya barkod numarasını elle girin."));
      }
    })();

    return () => {
      stopped = true;
      window.clearTimeout(raf);
      stopZxing?.();
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [t]);

  if (error) return <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted">{error}</p>;
  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
      <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-xl border-2 border-white/80" />
    </div>
  );
}
