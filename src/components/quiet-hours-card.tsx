"use client";
import { useMemo, useState } from "react";
import { Globe, MoonStar } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Card, Field, Input, Select, Switch } from "@/components/ui";
import { TimePicker15 } from "@/components/time-picker";
import { allTimeZones, isValidTimeZone, utcOffsetLabel } from "@/lib/bkn/schedule";

/** Profil: saat dilimi (otomatik ya da elle) ve sessiz saatler (bu aralıkta hiçbir bildirim gönderilmez). */
export function QuietHoursCard() {
  const { t, profile, saveProfile, toast } = useApp();
  const [filter, setFilter] = useState("");
  const zones = useMemo(() => allTimeZones(), []);
  if (!profile) return null;

  const device = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";
  const auto = profile.timezone_auto !== false;
  const quiet = profile.quiet_enabled !== false;
  const shown = (filter.trim() ? zones.filter((z) => z.toLowerCase().replace(/_/g, " ").includes(filter.trim().toLowerCase())) : zones).slice(0, 400);
  // Seçili alan listede yoksa (süzgeç yüzünden) kaybolmasın.
  const options = shown.includes(profile.timezone) ? shown : [profile.timezone, ...shown];

  const save = (patch: Partial<typeof profile>) => saveProfile(patch).catch(() => toast(t("Kaydedilemedi."), "error"));

  return (
    <Card className="space-y-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Globe size={18} className="text-primary" />
        {t("Saat dilimi ve sessiz saatler")}
      </h2>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{t("Saat dilimini otomatik algıla")}</p>
          <p className="text-xs text-muted">{t("Yolculukta ya da başka bir ülkedeyken bildirimler bulunduğun yerin saatine göre gelir.")}</p>
        </div>
        <Switch
          checked={auto}
          label={t("Saat dilimini otomatik algıla")}
          onChange={(v) => save(v && isValidTimeZone(device) ? { timezone_auto: true, timezone: device } : { timezone_auto: v })}
        />
      </div>

      <p className="text-xs text-muted">
        {t("Şu anki saat dilimin: {tz}", { tz: `${profile.timezone.replace(/_/g, " ")} (${utcOffsetLabel(profile.timezone)})` })}
      </p>

      {!auto && (
        <div className="space-y-2">
          <Field label={t("Saat dilimi seç")}>
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t("Ülke ya da şehir ara (örn. Istanbul, Berlin, New York)")} />
          </Field>
          <Select
            aria-label={t("Saat dilimi seç")}
            value={profile.timezone}
            onChange={(e) => {
              if (isValidTimeZone(e.target.value)) void save({ timezone: e.target.value, timezone_auto: false });
            }}
          >
            {options.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")} ({utcOffsetLabel(z)})
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <MoonStar size={15} className="text-primary" />
              {t("Sessiz saatler")}
            </p>
            <p className="text-xs text-muted">{t("Bu saatler arasında hiçbir bildirim gönderilmez.")}</p>
          </div>
          <Switch checked={quiet} label={t("Sessiz saatler")} onChange={(v) => void save({ quiet_enabled: v })} />
        </div>
        {quiet && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label={t("Başlangıç")}>
              <TimePicker15 label={t("Başlangıç")} value={profile.quiet_start ?? "22:00"} onChange={(v) => void save({ quiet_start: v })} />
            </Field>
            <Field label={t("Bitiş")}>
              <TimePicker15 label={t("Bitiş")} value={profile.quiet_end ?? "08:00"} onChange={(v) => void save({ quiet_end: v })} />
            </Field>
            {profile.ramadan_mode && <p className="col-span-2 text-xs text-muted">{t("Ramazan modunda sahurdan önceki 90 dakika sessiz saatlerin dışında tutulur.")}</p>}
          </div>
        )}
      </div>
    </Card>
  );
}
