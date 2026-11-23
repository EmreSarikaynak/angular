"use client";
import { useState } from "react";
import { Check, Download, MoreVertical, Plus } from "lucide-react";
import { Sheet } from "@/components/ui";
import { AndroidIcon, AppleIcon, ShareIcon } from "@/components/platform-icons";
import { promptInstall, useInstall, type Platform } from "@/lib/install";

type Lang = "tr" | "en";

const COPY = {
  tr: {
    button: "Ana ekrana ekle",
    ios: "iPhone / iPad",
    android: "Android",
    installed: "BKNY bu cihazda yüklü. Ana ekrandaki simgeden açabilirsin.",
    iosTitle: "iPhone / iPad'e ekle",
    androidTitle: "Android'e ekle",
    close: "Tamam",
    iosSteps: [
      "BKNY'yi Safari'de aç (bkny.com.tr).",
      "Alttaki Paylaş düğmesine dokun.",
      "Aşağı kaydırıp “Ana Ekrana Ekle”yi seç.",
      "Sağ üstte “Ekle”ye dokun. Simge ana ekranında belirir.",
    ],
    iosNote: "Apple, uygulamaların tek dokunuşla otomatik eklenmesine izin vermez; bu adımlar iOS'un kendi yöntemidir. Bildirimler için uygulamayı ana ekran simgesinden açman gerekir (iOS 16.4 ve üzeri).",
    iosInApp: "Şu an bir uygulama içi tarayıcıdasın. Sağ alttaki menüden “Safari'de aç”ı seçip adımları orada yap.",
    androidSteps: ["BKNY'yi Chrome'da aç (bkny.com.tr).", "Sağ üstteki menüye (⋮) dokun.", "“Uygulamayı yükle” ya da “Ana ekrana ekle”yi seç.", "Onayla. Simge ana ekranında ve uygulama çekmecesinde belirir."],
    androidNote: "Tarayıcın tek dokunuşla kurulum sunuyorsa, butona basmak yeterli olur; sunmuyorsa yukarıdaki adımları izle.",
    desktopNote: "Bu adımları telefonunda yapman gerekir: telefonunda bkny.com.tr adresini aç.",
  },
  en: {
    button: "Add to home screen",
    ios: "iPhone / iPad",
    android: "Android",
    installed: "BKNY is installed on this device. Open it from your home screen icon.",
    iosTitle: "Add to iPhone / iPad",
    androidTitle: "Add to Android",
    close: "Done",
    iosSteps: ["Open BKNY in Safari (bkny.com.tr).", "Tap the Share button at the bottom.", "Scroll down and choose “Add to Home Screen”.", "Tap “Add” at the top right. The icon appears on your home screen."],
    iosNote: "Apple does not let apps be added with a single automatic tap; these steps are iOS's own method. For notifications, open the app from the home-screen icon (iOS 16.4 or later).",
    iosInApp: "You are in an in-app browser. Choose “Open in Safari” from the menu at the bottom right and follow the steps there.",
    androidSteps: ["Open BKNY in Chrome (bkny.com.tr).", "Tap the menu (⋮) at the top right.", "Choose “Install app” or “Add to Home screen”.", "Confirm. The icon appears on your home screen and app drawer."],
    androidNote: "If your browser offers one-tap install, the button is enough; otherwise follow the steps above.",
    desktopNote: "These steps are done on your phone: open bkny.com.tr on your phone.",
  },
} as const;

/** Kurulum adımları paneli (iOS ve Android). */
export function InstallSheet({ target, open, onClose, lang }: { target: "ios" | "android"; open: boolean; onClose: () => void; lang: Lang }) {
  const c = COPY[lang];
  const { platform, inApp } = useInstall();
  const steps = target === "ios" ? c.iosSteps : c.androidSteps;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={target === "ios" ? c.iosTitle : c.androidTitle}
      footer={
        <button type="button" onClick={onClose} className="h-11 w-full rounded-xl bg-primary font-semibold text-white">
          {c.close}
        </button>
      }
    >
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s} className="flex items-start gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">{i + 1}</span>
            <span className="pt-0.5 text-sm">
              {s}
              {target === "ios" && i === 1 && (
                <span className="ml-1.5 inline-grid h-6 w-6 translate-y-1.5 place-items-center rounded-md bg-surface-2 text-primary">
                  <ShareIcon size={15} />
                </span>
              )}
              {target === "android" && i === 1 && <MoreVertical size={15} className="ml-1 inline text-muted" aria-hidden />}
            </span>
          </li>
        ))}
      </ol>
      {target === "ios" && platform === "ios" && inApp && <p className="mt-4 rounded-xl bg-warn/10 px-3 py-2 text-sm text-warn">{c.iosInApp}</p>}
      <p className="mt-4 text-xs text-muted">{target === "ios" ? c.iosNote : c.androidNote}</p>
      {platform === "desktop" && <p className="mt-2 text-xs font-medium text-muted">{c.desktopNote}</p>}
    </Sheet>
  );
}

/**
 * iOS ve Android "ana ekrana ekle" düğmeleri. Android'de tarayıcı destekliyorsa tek dokunuşla kurulum penceresi açılır,
 * yoksa (ve iOS'ta) adımlar gösterilir.
 */
export function InstallButtons({ lang, className }: { lang: Lang; className?: string }) {
  const c = COPY[lang];
  const { platform, standalone, canPrompt, ready } = useInstall();
  const [sheet, setSheet] = useState<"ios" | "android" | null>(null);
  const [done, setDone] = useState(false);

  async function click(target: Exclude<Platform, "desktop">) {
    if (target === "android" && platform === "android" && canPrompt) {
      const r = await promptInstall();
      if (r === "accepted") setDone(true);
      if (r !== "unavailable") return;
    }
    setSheet(target);
  }

  if (ready && (standalone || done)) {
    return (
      <p className={`flex items-center justify-center gap-2 rounded-xl bg-primary-soft px-4 py-3 text-sm font-medium text-primary ${className ?? ""}`}>
        <Check size={16} />
        {c.installed}
      </p>
    );
  }

  const btn = "inline-flex h-14 min-w-0 flex-1 items-center justify-center gap-3 rounded-2xl border border-border bg-surface px-4 text-left shadow-sm active:scale-[.98]";
  return (
    <div className={className}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => click("ios")} className={`${btn} ${ready && platform === "ios" ? "ring-2 ring-primary" : ""}`}>
          <AppleIcon size={26} className="shrink-0" />
          <span className="min-w-0 leading-tight">
            <span className="block text-[11px] text-muted">{c.button}</span>
            <span className="block truncate font-semibold">{c.ios}</span>
          </span>
          <Plus size={16} className="ml-auto shrink-0 text-muted" aria-hidden />
        </button>
        <button type="button" onClick={() => click("android")} className={`${btn} ${ready && platform === "android" ? "ring-2 ring-primary" : ""}`}>
          <AndroidIcon size={26} className="shrink-0 text-[#3ddc84]" />
          <span className="min-w-0 leading-tight">
            <span className="block text-[11px] text-muted">{c.button}</span>
            <span className="block truncate font-semibold">{c.android}</span>
          </span>
          {ready && platform === "android" && canPrompt ? <Download size={16} className="ml-auto shrink-0 text-primary" aria-hidden /> : <Plus size={16} className="ml-auto shrink-0 text-muted" aria-hidden />}
        </button>
      </div>
      <InstallSheet target={sheet ?? "ios"} open={!!sheet} onClose={() => setSheet(null)} lang={lang} />
    </div>
  );
}
