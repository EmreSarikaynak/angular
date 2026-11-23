"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { InstallSheet } from "@/components/install-buttons";
import { AndroidIcon, AppleIcon } from "@/components/platform-icons";
import { isNative } from "@/lib/native";
import { promptInstall, useInstall } from "@/lib/install";

const KEY = "bt:install-hint-dismissed";
const DAYS = 14;

/** Mobil tarayıcıda (uygulama olarak yüklü değilken) ana ekrana eklemeyi öneren, kapatılabilir kart. */
export function InstallHint() {
  const { t, lang } = useApp();
  const { platform, standalone, canPrompt, ready } = useInstall();
  const [dismissed, setDismissed] = useState(() => {
    try {
      const at = Number(localStorage.getItem(KEY) ?? 0);
      return !!at && Date.now() - at < DAYS * 86_400_000;
    } catch {
      return false;
    }
  });
  const [sheet, setSheet] = useState(false);
  if (!ready || standalone || dismissed || platform === "desktop" || isNative()) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {}
    setDismissed(true);
  };
  const add = async () => {
    if (platform === "android" && canPrompt) {
      const r = await promptInstall();
      if (r !== "unavailable") return r === "accepted" ? dismiss() : undefined;
    }
    setSheet(true);
  };
  const Icon = platform === "ios" ? AppleIcon : AndroidIcon;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
        <Icon size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">{t("BKNY'yi ana ekranına ekle")}</p>
        <p className="text-xs text-muted">{t("Uygulama gibi tek dokunuşla aç.")}</p>
      </div>
      <button type="button" onClick={add} className="h-9 shrink-0 rounded-lg bg-primary px-3 text-sm font-semibold text-white">
        {t("Ekle")}
      </button>
      <button type="button" onClick={dismiss} aria-label={t("Kapat")} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted">
        <X size={16} />
      </button>
      <InstallSheet target={platform === "ios" ? "ios" : "android"} open={sheet} onClose={() => { setSheet(false); }} lang={lang} />
    </div>
  );
}
