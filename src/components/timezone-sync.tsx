"use client";
import { useEffect } from "react";
import { useApp } from "@/components/app-provider";
import { isValidTimeZone } from "@/lib/bkn/schedule";

/**
 * "Saat dilimini otomatik algıla" açıkken, cihazın saat dilimi profildekinden farklıysa (yolculuk, ülke değişimi)
 * profili günceller; bildirimler ve günlük sınırları böylece kullanıcının bulunduğu yere göre çalışır.
 */
export function TimezoneSync() {
  const { profile, saveProfile } = useApp();
  const tz = profile?.timezone;
  const auto = profile?.timezone_auto !== false;
  const loaded = !!profile;
  useEffect(() => {
    if (!loaded || !auto) return;
    const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (isValidTimeZone(device) && device !== tz) void saveProfile({ timezone: device }).catch(() => {});
  }, [loaded, auto, tz, saveProfile]);
  return null;
}
