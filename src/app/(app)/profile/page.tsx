"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Download, Link2, LogOut, Shield, Stethoscope, Trash2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Bar, Button, Card, Chip, Field, Input, NumberInput, PageHeader, Segmented, Select, Sheet, Switch } from "@/components/ui";
import { api } from "@/lib/api";
import { exportAllData } from "@/lib/data/export-all";
import { clearLocalData } from "@/lib/data/store";
import { ageFrom, toDateKey } from "@/lib/dates";
import { download } from "@/lib/export";
import { ACTIVITY_LEVEL_LABELS, ALLERGY_OPTIONS, DIET_OPTIONS, GOAL_LABELS, label } from "@/lib/i18n/labels";
import { HealthConnectCard } from "@/components/health-connect";
import { QuietHoursCard } from "@/components/quiet-hours-card";
import { isNative } from "@/lib/native";
import { TimePicker15 } from "@/components/time-picker";
import { formatHHMM, toMinutes } from "@/lib/bkn/schedule";
import { calculateTargets } from "@/lib/nutrition/calc";
import { supabase } from "@/lib/supabase/client";
import { disableNotifications, enableNotifications, unsupportedText } from "@/lib/push";
import type { ActivityLevel, Goal, Lang, Profile, Sex, Theme } from "@/lib/types";

export default function ProfilePage() {
  const { t, lang, theme, setLang, setTheme, profile, saveProfile, toast, signOut, session, config, online } = useApp();
  const router = useRouter();
  const [form, setForm] = useState<Profile | null>(profile);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [otherAllergy, setOtherAllergy] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  useEffect(() => {
    if (!dirty) setForm(profile);
  }, [profile, dirty]);

  if (!form || !profile) return null;
  const set = (patch: Partial<Profile>) => {
    setDirty(true);
    setForm({ ...form, ...patch });
  };
  const age = form.birth_date ? ageFrom(form.birth_date) : null;
  const canCalc = !!(form.sex && form.height_cm && form.weight_kg && age != null && form.activity_level && form.goal);
  const computed = canCalc
    ? calculateTargets({ sex: form.sex as Sex, age: age as number, height_cm: form.height_cm as number, weight_kg: form.weight_kg as number, activity_level: form.activity_level as ActivityLevel, goal: form.goal as Goal, weekly_rate_kg: form.weekly_rate_kg })
    : null;
  const knownAllergies = Object.keys(ALLERGY_OPTIONS);
  const customAllergies = form.allergies.filter((a) => !knownAllergies.includes(a));
  const toggle = (key: "allergies" | "diet_preferences", v: string) => set({ [key]: form[key].includes(v) ? form[key].filter((x) => x !== v) : [...form[key], v] });

  function recalc() {
    if (!computed) return toast(t("Hesaplama için doğum tarihi, cinsiyet, boy, kilo, hedef ve hareketlilik gerekli."), "error");
    set({ kcal_target: computed.kcal_target, protein_target_g: computed.protein_target_g, carbs_target_g: computed.carbs_target_g, fat_target_g: computed.fat_target_g, water_target_ml: computed.water_target_ml, targets_custom: false });
  }

  async function save() {
    if (!form) return;
    if (!form.first_name?.trim() || !form.last_name?.trim()) return toast(t("Ad ve soyad gerekli."), "error");
    if (age == null || age < 13 || age > 110) return toast(t("Geçerli bir doğum tarihi girin (13 yaş ve üzeri)."), "error");
    if (!form.height_cm || form.height_cm < 100 || form.height_cm > 250) return toast(t("Boy 100–250 cm arasında olmalı."), "error");
    if (!form.kcal_target || form.kcal_target < 800 || form.kcal_target > 8000) return toast(t("Kalori hedefi 800–8000 kcal arasında olmalı."), "error");
    if (!form.water_target_ml || form.water_target_ml < 500 || form.water_target_ml > 8000) return toast(t("Su hedefi 500–8000 ml arasında olmalı."), "error");
    setBusy("save");
    try {
      await saveProfile({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        birth_date: form.birth_date,
        sex: form.sex,
        height_cm: form.height_cm,
        target_weight_kg: form.target_weight_kg,
        goal: form.goal,
        weekly_rate_kg: form.weekly_rate_kg,
        activity_level: form.activity_level,
        allergies: form.allergies,
        diet_preferences: form.diet_preferences,
        kcal_target: Math.round(form.kcal_target),
        protein_target_g: Math.round(form.protein_target_g ?? 0),
        carbs_target_g: Math.round(form.carbs_target_g ?? 0),
        fat_target_g: Math.round(form.fat_target_g ?? 0),
        water_target_ml: Math.round(form.water_target_ml),
        targets_custom: form.targets_custom,
        add_exercise_calories: form.add_exercise_calories,
        store_photos: form.store_photos,
      });
      setDirty(false);
      toast(t("Profil kaydedildi."));
    } catch {
      toast(t("Kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin."), "error");
    } finally {
      setBusy(null);
    }
  }

  async function exportData() {
    setBusy("export");
    try {
      download(`bkn-verilerim_${toDateKey()}.json`, await exportAllData());
    } catch {
      toast(t("Veriler indirilemedi. Bağlantınızı kontrol edin."), "error");
    } finally {
      setBusy(null);
    }
  }

  async function deletePhotos() {
    if (!confirm(t("Tüm yemek fotoğraflarınız kalıcı olarak silinecek. Kayıtlarınız korunur. Devam edilsin mi?"))) return;
    setBusy("photos");
    try {
      const res = await api<{ removed: number }>("/api/account/delete", { body: { scope: "photos", confirm: true } });
      toast(t("{n} fotoğraf silindi.", { n: res.removed }));
    } catch {
      toast(t("Fotoğraflar silinemedi."), "error");
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount() {
    setBusy("delete");
    try {
      await api("/api/account/delete", { body: { scope: "account", confirm: true } });
      await supabase().auth.signOut({ scope: "local" }).catch(() => {});
      clearLocalData();
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith("bt:"))
          .forEach((k) => localStorage.removeItem(k));
      } catch {
        /* yoksay */
      }
      router.replace("/login");
    } catch {
      toast(t("Hesap silinemedi. Lütfen tekrar deneyin."), "error");
      setBusy(null);
    }
  }

  /** Bildirim tercihini kaydeder; bir bildirim türü açılırken tarayıcı izni de istenir. */
  async function notify(patch: Partial<Profile>, turningOn = false) {
    try {
      if (turningOn) {
        const result = await enableNotifications();
        if (result === "unsupported") return toast(unsupportedText(t), "error");
        if (result === "denied") return toast(t("Bildirim izni verilmedi. Tarayıcı ayarlarından izin verebilirsiniz."), "error");
        patch = { ...patch, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || profile?.timezone };
      }
      await saveProfile(patch);
      const next = { ...profile, ...patch } as Profile;
      if (!next.reminder_enabled && !next.notify_supplements && !next.notify_protein && !next.notify_insights && !next.notify_summary && !next.notify_evening) await disableNotifications();
    } catch {
      toast(t("Kaydedilemedi."), "error");
    }
  }
  const toggleRow = (title: string, sub: string, checked: boolean, onChange: (v: boolean) => void) => (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted">{sub}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  );

  const targetField = (name: string, key: "kcal_target" | "protein_target_g" | "carbs_target_g" | "fat_target_g" | "water_target_ml", auto?: number) => (
    <Field label={name} hint={auto != null && auto !== form[key] ? t("Önerilen: {n}", { n: auto }) : undefined}>
      <NumberInput value={form[key]} onChange={(v) => set({ [key]: v, targets_custom: true })} min={0} />
    </Field>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={t("Profil")} subtitle={session?.user.email} />

      <Card className="space-y-3">
        <h2 className="font-semibold">{t("Kişisel bilgiler")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Ad")}>
            <Input value={form.first_name ?? ""} onChange={(e) => set({ first_name: e.target.value })} maxLength={80} />
          </Field>
          <Field label={t("Soyad")}>
            <Input value={form.last_name ?? ""} onChange={(e) => set({ last_name: e.target.value })} maxLength={80} />
          </Field>
          <Field label={t("Doğum tarihi")}>
            <Input type="date" value={form.birth_date ?? ""} max={toDateKey()} onChange={(e) => set({ birth_date: e.target.value || null })} />
          </Field>
          <Field label={t("Cinsiyet")}>
            <Select value={form.sex ?? ""} onChange={(e) => set({ sex: (e.target.value || null) as Sex | null })}>
              <option value="female">{t("Kadın")}</option>
              <option value="male">{t("Erkek")}</option>
            </Select>
          </Field>
          <Field label={t("Boy (cm)")}>
            <NumberInput value={form.height_cm} onChange={(v) => set({ height_cm: v })} min={100} max={250} />
          </Field>
          <Field label={t("Kilo (kg)")} hint={t("Ölçümler sayfasından güncellenir.")}>
            <Link href="/body" className="flex h-11 items-center rounded-xl border border-border bg-surface-2 px-3 text-text">
              {form.weight_kg ?? "–"}
            </Link>
          </Field>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">{t("Hedefler")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Hedef")}>
            <Select value={form.goal ?? "maintain"} onChange={(e) => set({ goal: e.target.value as Goal })}>
              {Object.keys(GOAL_LABELS).map((k) => (
                <option key={k} value={k}>
                  {label(GOAL_LABELS, k, lang)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("Hedef kilo (kg)")}>
            <NumberInput value={form.target_weight_kg} onChange={(v) => set({ target_weight_kg: v })} min={30} max={300} step="0.1" />
          </Field>
          <Field label={t("Haftalık hız")}>
            <Select value={form.weekly_rate_kg} onChange={(e) => set({ weekly_rate_kg: Number(e.target.value) })} disabled={form.goal === "maintain"}>
              {[0, 0.25, 0.5, 0.75, 1].map((r) => (
                <option key={r} value={r}>
                  {String(r).replace(".", ",")} kg
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("Günlük hareketlilik seviyesi")}>
            <Select value={form.activity_level ?? "light"} onChange={(e) => set({ activity_level: e.target.value as ActivityLevel })}>
              {Object.keys(ACTIVITY_LEVEL_LABELS).map((k) => (
                <option key={k} value={k}>
                  {label(ACTIVITY_LEVEL_LABELS, k, lang)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-3">
          <p className="text-xs text-muted">
            {computed ? t("Tahmini günlük harcamanız {tdee} kcal (bazal {bmr} kcal).", { tdee: computed.tdee, bmr: computed.bmr }) : t("Hesaplama için kişisel bilgilerinizi tamamlayın.")}
            {form.targets_custom ? ` ${t("Hedefler elle düzenlendi.")}` : ""}
          </p>
          <Button size="sm" variant="secondary" onClick={recalc} className="shrink-0">
            {t("Yeniden hesapla")}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {targetField(t("Kalori (kcal)"), "kcal_target", computed?.kcal_target)}
          {targetField(t("Protein (g)"), "protein_target_g", computed?.protein_target_g)}
          {targetField(t("Karbonhidrat (g)"), "carbs_target_g", computed?.carbs_target_g)}
          {targetField(t("Yağ (g)"), "fat_target_g", computed?.fat_target_g)}
          {targetField(t("Su (ml)"), "water_target_ml", computed?.water_target_ml)}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{t("Egzersiz kalorilerini günlük bütçeye ekle")}</p>
            <p className="text-xs text-muted">{t("Hareketlilik seviyeniz hedefinize zaten dahil olduğundan kapalı tutmanız önerilir; açarsanız sporla yakılan net kalori kalan kalorinize eklenir.")}</p>
          </div>
          <Switch checked={form.add_exercise_calories} onChange={(v) => set({ add_exercise_calories: v })} label={t("Egzersiz kalorilerini günlük bütçeye ekle")} />
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">{t("Alerjiler ve beslenme tercihleri")}</h2>
        <Field label={t("Besin alerjileri (varsa)")}>
          <div className="flex flex-wrap gap-2">
            {knownAllergies.map((k) => (
              <Chip key={k} active={form.allergies.includes(k)} onClick={() => toggle("allergies", k)}>
                {label(ALLERGY_OPTIONS, k, lang)}
              </Chip>
            ))}
            {customAllergies.map((a) => (
              <Chip key={a} active onClick={() => toggle("allergies", a)}>
                {a} ×
              </Chip>
            ))}
          </div>
        </Field>
        <div className="flex gap-2">
          <Input value={otherAllergy} onChange={(e) => setOtherAllergy(e.target.value)} placeholder={t("Diğer alerji ekle")} maxLength={40} />
          <Button
            variant="secondary"
            disabled={!otherAllergy.trim()}
            onClick={() => {
              const v = otherAllergy.trim();
              if (!form.allergies.includes(v)) set({ allergies: [...form.allergies, v] });
              setOtherAllergy("");
            }}
            className="shrink-0"
          >
            {t("Ekle")}
          </Button>
        </div>
        <Field label={t("Beslenme tercihleri")}>
          <div className="flex flex-wrap gap-2">
            {Object.keys(DIET_OPTIONS).map((k) => (
              <Chip key={k} active={form.diet_preferences.includes(k)} onClick={() => toggle("diet_preferences", k)}>
                {label(DIET_OPTIONS, k, lang)}
              </Chip>
            ))}
          </div>
        </Field>
      </Card>

      {dirty && (
        <div className="sticky bottom-20 z-30 lg:bottom-4">
          <Button size="lg" className="w-full shadow-lg" loading={busy === "save"} onClick={save}>
            {t("Değişiklikleri kaydet")}
          </Button>
        </div>
      )}

      <Card className="space-y-4">
        <h2 className="font-semibold">{t("Bildirimler")}</h2>
        <p className="text-xs text-muted">{t("BKNY; su, takviye ve hedeflerinizi motive edici mesajlarla hatırlatır. Sıklığı buradan ayarlayabilirsiniz.")}</p>
        {toggleRow(t("Su hatırlatmaları"), t("Hedefe ulaşana kadar belirlediğiniz aralıkla."), profile.reminder_enabled, (v) => notify({ reminder_enabled: v }, v))}
        {profile.reminder_enabled && (
          <div className="grid grid-cols-3 gap-2">
            <Field label={t("Aralık")}>
              <Select value={profile.reminder_interval_min} onChange={(e) => notify({ reminder_interval_min: Number(e.target.value) })}>
                {[15, 30, 45, 60, 90, 120, 180, 240].map((m) => (
                  <option key={m} value={m}>
                    {m < 60 ? `${m} ${t("dk")}` : `${m / 60} ${t("saat")}`}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("Başlangıç")}>
              <TimePicker15 label={t("Başlangıç")} value={formatHHMM(toMinutes(profile.reminder_start_hour, profile.reminder_start_minute ?? 0))} onChange={(v) => notify({ reminder_start_hour: Number(v.slice(0, 2)), reminder_start_minute: Number(v.slice(3, 5)) })} />
            </Field>
            <Field label={t("Bitiş")}>
              <TimePicker15 label={t("Bitiş")} value={formatHHMM(toMinutes(profile.reminder_end_hour, profile.reminder_end_minute ?? 0))} onChange={(v) => notify({ reminder_end_hour: Number(v.slice(0, 2)), reminder_end_minute: Number(v.slice(3, 5)) })} />
            </Field>
          </div>
        )}
        {toggleRow(t("Takviye hatırlatmaları"), t("Saati geldiğinde; almadıysanız seçtiğiniz aralıkla yeniden."), profile.notify_supplements, (v) => notify({ notify_supplements: v }, v))}
        {profile.notify_supplements && (
          <Field label={t("Alınmayan takviye için tekrar sıklığı")}>
            <Select value={profile.supplement_nag_min} onChange={(e) => notify({ supplement_nag_min: Number(e.target.value) })}>
              <option value={0}>{t("Tekrar etme (yalnızca bir kez)")}</option>
              <option value={15}>{t("15 dakikada bir")}</option>
              <option value={30}>{t("30 dakikada bir")}</option>
              <option value={60}>{t("Saatte bir")}</option>
              <option value={120}>{t("2 saatte bir")}</option>
            </Select>
          </Field>
        )}
        {toggleRow(t("Protein hatırlatması"), t("Gün içinde protein hedefinin gerisindeyseniz tarif önerisiyle."), profile.notify_protein, (v) => notify({ notify_protein: v }, v))}
        {profile.notify_protein && (
          <Field label={t("Kontrol saati")}>
            <TimePicker15 label={t("Kontrol saati")} value={formatHHMM(toMinutes(profile.protein_check_hour, profile.protein_check_minute ?? 0))} onChange={(v) => notify({ protein_check_hour: Number(v.slice(0, 2)), protein_check_minute: Number(v.slice(3, 5)) })} />
          </Field>
        )}
        {toggleRow(t("Eğilim uyarıları"), t("Son 2–3 günde bir değer hedefin belirgin üstünde ya da altındaysa öneriyle; aynı konuda en çok 3 günde bir."), profile.notify_insights, (v) => notify({ notify_insights: v }, v))}
        {toggleRow(t("Akşam kapanışı"), t("Her akşam “Bugün kendin için ne yaptın?” sorusuyla günün kısa özeti."), profile.notify_evening, (v) => notify({ notify_evening: v }, v))}
        {profile.notify_evening && (
          <Field label={t("Kapanış saati")}>
            <TimePicker15 label={t("Kapanış saati")} value={formatHHMM(toMinutes(profile.evening_hour, profile.evening_minute ?? 0))} onChange={(v) => notify({ evening_hour: Number(v.slice(0, 2)), evening_minute: Number(v.slice(3, 5)) })} />
          </Field>
        )}
        {toggleRow(t("Performans özeti"), t("Her pazartesi haftalık, her ayın ilk günü aylık özet hazır olduğunda."), profile.notify_summary, (v) => notify({ notify_summary: v }, v))}
        <Button
          variant="secondary"
          className="w-full"
          onClick={async () => {
            const result = await enableNotifications();
            if (result === "unsupported") toast(unsupportedText(t), "error");
            else if (result === "denied") toast(t("Bildirim izni verilmedi. Tarayıcı ayarlarından izin verebilirsiniz."), "error");
            else {
              await saveProfile({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || profile.timezone }).catch(() => {});
              toast(result === "push" ? t("Bu cihazda bildirimler açık.") : t("Hatırlatmalar açıldı (uygulama açıkken gösterilir)."));
            }
          }}
        >
          <Bell size={16} />
          {t("Bu cihazda bildirimleri aç")}
        </Button>
        <p className="text-xs text-muted">{(isNative() ? config?.fcm_available : config?.web_push_available) ? t("Bildirimler bu cihazda tarayıcı izni gerektirir. iPhone'da önce uygulamayı ana ekrana ekleyin.") : t("Sunucu bildirimleri yapılandırılmamış; hatırlatmalar yalnızca uygulama açıkken gösterilir.")}</p>
      </Card>

      <QuietHoursCard />

      <HealthConnectCard />

      <Card className="space-y-3">
        {toggleRow(t("Ramazan modu"), t("Öğünler Sahur ve İftar olarak adlandırılır; su ve beslenme hatırlatmaları yalnızca iftar ile sahur arasında gönderilir."), profile.ramadan_mode, (v) => notify({ ramadan_mode: v }))}
        {profile.ramadan_mode && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("İftar saati")}>
              <Input type="time" value={profile.iftar_time} onChange={(e) => e.target.value && notify({ iftar_time: e.target.value })} />
            </Field>
            <Field label={t("Sahur bitişi (imsak)")}>
              <Input type="time" value={profile.sahur_time} onChange={(e) => e.target.value && notify({ sahur_time: e.target.value })} />
            </Field>
            <p className="col-span-2 text-xs text-muted">{t("Saatler şehre ve güne göre değişir; bulunduğunuz yerin vakitlerini girip birkaç günde bir güncelleyin.")}</p>
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">{t("Uygulama")}</h2>
        <Field label={t("Dil")}>
          <Segmented<Lang> value={lang} onChange={setLang} options={[{ value: "tr", label: "Türkçe" }, { value: "en", label: "English" }]} />
        </Field>
        <Field label={t("Tema")}>
          <Segmented<Theme> value={theme} onChange={setTheme} options={[{ value: "system", label: t("Sistem") }, { value: "light", label: t("Açık") }, { value: "dark", label: t("Koyu") }]} />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{t("Yemek fotoğraflarını sakla")}</p>
            <p className="text-xs text-muted">{t("Kapalıyken fotoğraf yalnızca analiz için kullanılır ve saklanmaz.")}</p>
          </div>
          <Switch checked={form.store_photos} onChange={(v) => set({ store_photos: v })} label={t("Yemek fotoğraflarını sakla")} />
        </div>
        {config && (
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span>{t("Bugünkü yapay zekâ kullanımı")}</span>
              <span className="font-semibold">
                {config.quota.used} / {config.quota.limit}
              </span>
            </div>
            <Bar value={config.quota.used} max={config.quota.limit} />
          </div>
        )}
        <p className="text-xs text-muted">{t("Ana ekrana eklemek için: iPhone'da Safari › Paylaş › “Ana Ekrana Ekle”; Android'de Chrome menüsü › “Uygulamayı yükle”.")}</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">{t("Verileriniz ve gizlilik")}</h2>
        <p className="text-xs text-muted">
          {t("Verileriniz yalnızca size aittir. Dilediğiniz zaman indirebilir veya kalıcı olarak silebilirsiniz.")}{" "}
          <Link href="/privacy" className="font-medium text-primary underline">
            {t("Gizlilik ve KVKK aydınlatma metni")}
          </Link>
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/sharing" className="inline-flex h-11 items-center gap-2 rounded-xl bg-surface-2 px-4 text-sm font-semibold">
            <Link2 size={16} />
            {t("Diyetisyenimle paylaş")}
          </Link>
          <Button variant="secondary" loading={busy === "export"} disabled={!online} onClick={exportData}>
            <Download size={16} />
            {t("Verilerimi indir")}
          </Button>
          <Button variant="secondary" loading={busy === "photos"} disabled={!online} onClick={deletePhotos}>
            <Trash2 size={16} />
            {t("Fotoğraflarımı sil")}
          </Button>
          <Button variant="danger" disabled={!online} onClick={() => setDeleteOpen(true)}>
            <Trash2 size={16} />
            {t("Hesabımı sil")}
          </Button>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link href="/dietitian" className="inline-flex h-11 items-center gap-2 rounded-xl bg-surface-2 px-4 text-sm font-semibold">
          <Stethoscope size={16} />
          {t("Diyetisyen paneli")}
        </Link>
        {config?.is_admin && (
          <Link href="/admin" className="inline-flex h-11 items-center gap-2 rounded-xl bg-surface-2 px-4 text-sm font-semibold">
            <Shield size={16} />
            {t("Yönetim paneli")}
          </Link>
        )}
        <Button
          variant="secondary"
          onClick={async () => {
            await signOut();
            router.replace("/login");
          }}
        >
          <LogOut size={16} />
          {t("Çıkış yap")}
        </Button>
      </div>

      <Sheet open={deleteOpen} onClose={() => setDeleteOpen(false)} title={t("Hesabı kalıcı olarak sil")}>
        <div className="space-y-3">
          <p className="text-sm text-muted">{t("Hesabınız, tüm kayıtlarınız, ölçümleriniz, sohbet geçmişiniz ve fotoğraflarınız kalıcı olarak silinir. Bu işlem geri alınamaz.")}</p>
          <Field label={t("Onaylamak için SİL yazın")}>
            <Input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} autoCapitalize="characters" />
          </Field>
          <Button variant="danger" size="lg" className="w-full" disabled={!["SİL", "SIL", "DELETE"].includes(deleteText.trim().toUpperCase())} loading={busy === "delete"} onClick={deleteAccount}>
            {t("Hesabımı kalıcı olarak sil")}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
