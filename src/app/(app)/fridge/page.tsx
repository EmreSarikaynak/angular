"use client";
import { useRef, useState } from "react";
import { Camera, Check, Image as ImageIcon, Plus, Refrigerator, RefreshCw, Sparkles, X } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button, Card, Input, PageHeader, Textarea } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { mealLabel } from "@/lib/bkn/ramadan";
import { upsertRow, uuid } from "@/lib/data/store";
import { timestampFor, toDateKey } from "@/lib/dates";
import { errorText } from "@/lib/errors";
import { compressImage, type CompressedImage } from "@/lib/image";
import type { Meal } from "@/lib/types";

interface FridgeRecipe {
  name: string;
  meal: Meal;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  minutes: number;
  uses: string[];
  missing: string[];
  steps: string;
  why: string;
}
interface FridgeResult {
  ingredients: string[];
  recipes: FridgeRecipe[];
}

const MAX_PHOTOS = 3;

export default function FridgePage() {
  const { t, lang, profile, toast, online, config, refreshConfig } = useApp();
  const [photos, setPhotos] = useState<CompressedImage[]>([]);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<FridgeResult | null>(null);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const aiReady = online && config?.ai_available !== false;
  const today = toDateKey();

  async function addPhoto(file: File | undefined) {
    if (!file || photos.length >= MAX_PHOTOS) return;
    setError(null);
    try {
      const image = await compressImage(file);
      setPhotos((p) => [...p, image].slice(0, MAX_PHOTOS));
    } catch {
      setError(t("Fotoğraf okunamadı. Başka bir fotoğraf deneyin."));
    }
  }

  async function suggest(body: { images?: CompressedImage[]; ingredients?: string[] }) {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ result: FridgeResult }>("/api/ai/fridge", {
        body: {
          lang,
          images: body.images?.map((i) => ({ data: i.base64, mimeType: i.mimeType })),
          ingredients: body.ingredients,
          meal_kcal: profile?.kcal_target ? Math.round(profile.kcal_target * 0.3) : undefined,
          meal_protein_g: profile?.protein_target_g ? Math.round(profile.protein_target_g * 0.3) : undefined,
        },
      });
      void refreshConfig();
      if (!res.result.ingredients.length) {
        setError(body.images ? t("Fotoğrafta yiyecek malzemesi seçemedim. Daha yakından ve aydınlık bir fotoğraf deneyin ya da malzemeleri yazın.") : t("Malzeme bulunamadı. Virgülle ayırarak yazın."));
        return;
      }
      setResult(res.result);
      setIngredients(res.result.ingredients);
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : "", t));
    } finally {
      setBusy(false);
    }
  }

  const typedList = typed
    .split(/[,\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40);

  function startFromInput() {
    if (photos.length) return void suggest({ images: photos });
    void suggest({ ingredients: typedList });
  }

  function addIngredient() {
    const v = extra.trim().slice(0, 60);
    if (!v) return;
    setIngredients((cur) => (cur.some((x) => x.toLowerCase() === v.toLowerCase()) || cur.length >= 40 ? cur : [...cur, v]));
    setExtra("");
  }

  function startOver() {
    setResult(null);
    setIngredients([]);
    setPhotos([]);
    setTyped("");
    setError(null);
  }

  async function addToDiary(r: FridgeRecipe) {
    try {
      await upsertRow("food_entries", {
        id: uuid(), entry_date: today, consumed_at: timestampFor(today), meal: r.meal, name: r.name.slice(0, 200), quantity: 1, unit: t("porsiyon"), grams: null,
        kcal: r.kcal, protein_g: r.protein_g, carbs_g: r.carbs_g, fat_g: r.fat_g, sugar_g: 0, fiber_g: 0, salt_g: 0, alcohol_g: 0,
        source: "manual", data_source: "ai", is_estimated: true, confidence: null, photo_path: null, group_id: null, group_name: null, drink_type: null, volume_ml: null, abv: null, note: null,
      });
      toast(t("Günlüğe eklendi."));
    } catch {
      toast(t("Kaydedilemedi."), "error");
    }
  }

  const notice = !aiReady && (
    <p className="rounded-xl bg-warn/10 px-3 py-2.5 text-sm text-warn">{!online ? t("Çevrimdışısınız. Yemek önerisi için bağlantı gerekir.") : t("Yapay zekâ servisi şu anda kullanılamıyor. Elle kayıt ekleyebilirsiniz.")}</p>
  );
  const errorBox = error && (
    <p className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger" role="alert">
      {error}
    </p>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={t("Buzdolabından yemeğe")} subtitle={t("Elinizdekilerle ne pişirebilirsiniz?")} />
      {notice}
      {errorBox}

      {busy ? (
        <Card className="flex flex-col items-center gap-3 py-10">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary border-t-transparent" role="status" />
          <p className="text-sm font-medium">{t("Malzemeler okunuyor, tarifler hazırlanıyor…")}</p>
          <p className="text-xs text-muted">{t("Bu işlem birkaç saniye sürebilir.")}</p>
        </Card>
      ) : !result ? (
        <Card className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
              <Refrigerator size={22} />
            </span>
            <p className="text-sm text-muted">{t("Buzdolabınızın ya da dolabınızın içini fotoğraflayın (en fazla {n} fotoğraf). Malzemeleri tanıyıp alerjilerinize ve tercihlerinize uygun yemek önerileri sunarız.", { n: MAX_PHOTOS })}</p>
          </div>

          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void addPhoto(e.target.files?.[0]); e.target.value = ""; }} />
          <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => { void addPhoto(e.target.files?.[0]); e.target.value = ""; }} />
          <div className="grid grid-cols-2 gap-3">
            <Button disabled={!aiReady || photos.length >= MAX_PHOTOS} onClick={() => cameraRef.current?.click()}>
              <Camera size={18} />
              {t("Fotoğraf çek")}
            </Button>
            <Button variant="secondary" disabled={!aiReady || photos.length >= MAX_PHOTOS} onClick={() => galleryRef.current?.click()}>
              <ImageIcon size={18} />
              {t("Galeriden seç")}
            </Button>
          </div>

          {photos.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <li key={i} className="relative h-20 w-20 overflow-hidden rounded-xl border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.dataUrl} alt={t("Seçilen fotoğraf {n}", { n: i + 1 })} className="h-full w-full object-cover" />
                  <button type="button" aria-label={t("Fotoğrafı kaldır")} onClick={() => setPhotos((cur) => cur.filter((_, j) => j !== i))} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white">
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2">
            <label htmlFor="fridge-typed" className="text-sm font-medium">
              {t("Ya da malzemeleri yazın")}
            </label>
            <Textarea id="fridge-typed" rows={3} value={typed} maxLength={600} placeholder={t("yumurta, domates, beyaz peynir, makarna")} onChange={(e) => setTyped(e.target.value)} disabled={photos.length > 0} />
          </div>

          <Button className="w-full" size="lg" disabled={!aiReady || (!photos.length && !typedList.length)} onClick={startFromInput}>
            <Sparkles size={18} />
            {t("Yemek öner")}
          </Button>
          <p className="text-xs text-muted">{t("Fotoğraflar yalnızca analiz için gönderilir ve hesabınıza kaydedilmez.")}</p>
        </Card>
      ) : (
        <>
          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">{t("Bulunan malzemeler")}</h2>
              <button type="button" onClick={startOver} className="text-sm font-medium text-primary">
                {t("Baştan başla")}
              </button>
            </div>
            <ul className="flex flex-wrap gap-2">
              {ingredients.map((x) => (
                <li key={x}>
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-1 pl-3 pr-1.5 text-sm">
                    {x}
                    <button type="button" aria-label={t("{name} malzemesini çıkar", { name: x })} onClick={() => setIngredients((cur) => cur.filter((y) => y !== x))} className="grid h-5 w-5 place-items-center rounded-full text-muted hover:text-danger">
                      <X size={13} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Input value={extra} maxLength={60} placeholder={t("Malzeme ekle")} onChange={(e) => setExtra(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addIngredient()} />
              <Button variant="secondary" aria-label={t("Ekle")} onClick={addIngredient} disabled={!extra.trim()}>
                <Plus size={18} />
              </Button>
            </div>
            <Button variant="secondary" className="w-full" disabled={!aiReady || !ingredients.length} onClick={() => suggest({ ingredients })}>
              <RefreshCw size={16} />
              {t("Bu listeyle yeniden öner")}
            </Button>
          </Card>

          {result.recipes.length === 0 ? (
            <Card>
              <p className="text-sm text-muted">{t("Bu malzemelerle uygun bir tarif çıkaramadım. Birkaç malzeme daha ekleyip yeniden deneyin.")}</p>
            </Card>
          ) : (
            result.recipes.map((r, i) => (
              <Card key={i} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold">{r.name}</h3>
                    <p className="text-xs text-muted">
                      {mealLabel(r.meal, lang, profile?.ramadan_mode)} · {t("{n} dk", { n: r.minutes })}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-sm tabular-nums">
                    <p className="font-semibold">{r.kcal} kcal</p>
                    <p className="text-xs text-muted">{t("{p} g protein", { p: r.protein_g })}</p>
                  </div>
                </div>
                {r.why && <p className="text-sm text-muted">{r.why}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {r.uses.map((u) => (
                    <span key={u} className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
                      <Check size={12} />
                      {u}
                    </span>
                  ))}
                  {r.missing.map((m) => (
                    <span key={m} className="rounded-full border border-dashed border-warn px-3 py-1 text-xs text-warn">
                      {t("Eksik: {name}", { name: m })}
                    </span>
                  ))}
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium text-primary">{t("Yapılışı")}</summary>
                  <p className="mt-2 whitespace-pre-line text-muted">{r.steps}</p>
                </details>
                <Button variant="secondary" className="w-full" onClick={() => addToDiary(r)}>
                  <Plus size={16} />
                  {t("Günlüğe ekle")}
                </Button>
              </Card>
            ))
          )}
          <p className="text-xs text-muted">{t("Besin değerleri yapay zekâ tahminidir. Alerjiniz varsa malzemeleri her zaman kendiniz kontrol edin.")}</p>
        </>
      )}
    </div>
  );
}
