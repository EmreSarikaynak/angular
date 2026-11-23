"use client";
import { useRef, useState } from "react";
import { Archive, Camera, Check, Clock, Image as ImageIcon, Plus, Refrigerator, RefreshCw, Snowflake, Sparkles, TriangleAlert, X } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button, Card, Chip, Input, PageHeader, Sheet, Skeleton, Textarea, cx } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { daysLeft, mergeScan, normalizeName, pantryStatus, sortByUrgency, type ScannedItem } from "@/lib/bkn/pantry";
import { mealLabel } from "@/lib/bkn/ramadan";
import { usePantry } from "@/lib/data/hooks";
import { deleteRow, upsertRow, uuid } from "@/lib/data/store";
import { timestampFor, toDateKey } from "@/lib/dates";
import { errorText } from "@/lib/errors";
import { compressImage, type CompressedImage } from "@/lib/image";
import type { Meal, PantryItem, PantryLocation } from "@/lib/types";

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

const MAX_PHOTOS = 3;
const LOCATIONS: PantryLocation[] = ["fridge", "freezer", "pantry"];
const LOC_ICON = { fridge: Refrigerator, freezer: Snowflake, pantry: Archive } as const;

export default function FridgePage() {
  const { t, lang, profile, toast, online, config, refreshConfig } = useApp();
  const pantry = usePantry();
  const [loc, setLoc] = useState<PantryLocation>("fridge");
  const [filter, setFilter] = useState<"all" | PantryLocation>("all");
  const [photos, setPhotos] = useState<CompressedImage[]>([]);
  const [typed, setTyped] = useState("");
  const [scanned, setScanned] = useState<ScannedItem[] | null>(null);
  const [recipes, setRecipes] = useState<FridgeRecipe[] | null>(null);
  const [busy, setBusy] = useState<"scan" | "suggest" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PantryItem | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const aiReady = online && config?.ai_available !== false;
  const today = toDateKey();
  const items = sortByUrgency(pantry.data ?? [], today);
  const shown = items.filter((i) => filter === "all" || i.location === filter);
  const usable = items.filter((i) => pantryStatus(i, today) !== "expired");
  const soon = items.filter((i) => pantryStatus(i, today) === "soon");
  const locLabel = { fridge: t("Buzdolabı"), freezer: t("Buzluk"), pantry: t("Dolap") };
  const typedList = typed
    .split(/[,\n;]+/)
    .map((s) => s.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 40);

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

  async function scan() {
    setBusy("scan");
    setError(null);
    try {
      const res = await api<{ result: { items: ScannedItem[] } }>("/api/ai/fridge", {
        body: { mode: "scan", lang, location: loc, today, images: photos.map((i) => ({ data: i.base64, mimeType: i.mimeType })) },
      });
      void refreshConfig();
      if (!res.result.items.length) return setError(t("Fotoğrafta yiyecek seçemedim. Daha yakından ve aydınlık bir fotoğraf deneyin ya da ürünleri yazın."));
      setScanned(res.result.items);
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : "", t));
    } finally {
      setBusy(null);
    }
  }

  async function saveScanned(list: ScannedItem[]) {
    const { add, update } = mergeScan(pantry.data ?? [], list, loc, today, uuid);
    try {
      for (const row of add) await upsertRow("pantry_items", row);
      for (const u of update) {
        const have = (pantry.data ?? []).find((p) => p.id === u.id);
        if (have) {
          const { user_id: _u, created_at: _c, ...row } = have as PantryItem & { updated_at?: string };
          delete (row as { updated_at?: string }).updated_at;
          await upsertRow("pantry_items", { ...row, ...u });
        }
      }
      toast(t("{n} ürün envantere eklendi.", { n: add.length }));
      setScanned(null);
      setPhotos([]);
      setTyped("");
    } catch {
      toast(t("Kaydedilemedi."), "error");
    }
  }

  async function saveEdit() {
    if (!editing || !editing.name.trim()) return;
    try {
      const { user_id: _u, created_at: _c, ...row } = editing as PantryItem & { updated_at?: string };
      delete (row as { updated_at?: string }).updated_at;
      await upsertRow("pantry_items", { ...row, name: row.name.trim().slice(0, 80) });
      setEditing(null);
    } catch {
      toast(t("Kaydedilemedi."), "error");
    }
  }

  async function remove(item: PantryItem) {
    try {
      await deleteRow("pantry_items", item.id);
      setEditing(null);
    } catch {
      toast(t("Silinemedi."), "error");
    }
  }

  async function suggest() {
    setBusy("suggest");
    setError(null);
    try {
      const res = await api<{ result: { recipes: FridgeRecipe[] } }>("/api/ai/fridge", {
        body: {
          mode: "suggest",
          lang,
          inventory: usable.slice(0, 40).map((i) => ({ name: i.name, location: i.location, days_left: daysLeft(i, today) })),
          meal_kcal: profile?.kcal_target ? Math.round(profile.kcal_target * 0.3) : undefined,
          meal_protein_g: profile?.protein_target_g ? Math.round(profile.protein_target_g * 0.3) : undefined,
        },
      });
      void refreshConfig();
      setRecipes(res.result.recipes);
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : "", t));
    } finally {
      setBusy(null);
    }
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

  const badge = (item: PantryItem) => {
    const status = pantryStatus(item, today);
    const d = daysLeft(item, today);
    if (status === "unknown" || d == null) return null;
    if (status === "expired") return <span className="inline-flex items-center gap-1 text-xs font-medium text-danger"><TriangleAlert size={12} />{t("Süresi geçmiş olabilir")}</span>;
    const text = d === 0 ? t("Bugün son gün") : t("{n} gün kaldı", { n: d });
    return <span className={cx("inline-flex items-center gap-1 text-xs font-medium", status === "soon" ? "text-warn" : "text-muted")}>{status === "soon" && <Clock size={12} />}{text}</span>;
  };

  const notice = !aiReady && (
    <p className="rounded-xl bg-warn/10 px-3 py-2.5 text-sm text-warn">{!online ? t("Çevrimdışısınız. Fotoğraf okuma ve yemek önerisi için bağlantı gerekir.") : t("Yapay zekâ servisi şu anda kullanılamıyor. Elle kayıt ekleyebilirsiniz.")}</p>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={t("Buzdolabından yemeğe")} subtitle={t("Elinizdekilerle ne pişirebilirsiniz?")} />
      {notice}
      {error && (
        <p className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {pantry.error && <p className="rounded-xl bg-warn/10 px-3 py-2.5 text-sm text-warn">{t("Envanter şu an yüklenemedi. Veritabanı güncellemesi (migration) gerekebilir.")}</p>}

      {/* Envanter */}
      {pantry.loading && !pantry.data ? (
        <Skeleton className="h-24" />
      ) : items.length > 0 ? (
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">{t("Envanterim")}</h2>
            <span className="text-xs text-muted">{t("{n} ürün", { n: items.length })}</span>
          </div>
          {soon.length > 0 && (
            <p className="flex items-start gap-2 rounded-xl bg-warn/10 px-3 py-2 text-sm text-warn">
              <Clock size={16} className="mt-0.5 shrink-0" />
              {t("Önce tüketilecekler: {names}", { names: soon.slice(0, 4).map((i) => i.name).join(", ") })}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Chip active={filter === "all"} onClick={() => setFilter("all")}>
              {t("Tümü")}
            </Chip>
            {LOCATIONS.map((l) => (
              <Chip key={l} active={filter === l} onClick={() => setFilter(l)}>
                {locLabel[l]}
              </Chip>
            ))}
          </div>
          <ul className="divide-y divide-border">
            {shown.map((i) => {
              const Icon = LOC_ICON[i.location];
              return (
                <li key={i.id}>
                  <button type="button" onClick={() => setEditing(i)} className="flex w-full items-center gap-3 py-2.5 text-left">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{i.name}</span>
                      {badge(i)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Button className="w-full" size="lg" loading={busy === "suggest"} disabled={!aiReady || !usable.length || busy !== null} onClick={suggest}>
            <Sparkles size={18} />
            {t("Elimdekilerle yemek öner")}
          </Button>
          <p className="text-xs text-muted">{t("Süreler tahmindir; paketteki tarihe, görünüşe ve kokuya göre karar verin. Bir yiyeceğin güvenli olduğunu garanti etmez.")}</p>
        </Card>
      ) : null}

      {busy === "suggest" && (
        <Card className="flex flex-col items-center gap-3 py-8">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary border-t-transparent" role="status" />
          <p className="text-sm font-medium">{t("Tarifler hazırlanıyor…")}</p>
        </Card>
      )}

      {recipes && busy !== "suggest" && (
        <>
          {recipes.length === 0 ? (
            <Card>
              <p className="text-sm text-muted">{t("Bu ürünlerle uygun bir tarif çıkaramadım. Birkaç ürün daha ekleyip yeniden deneyin.")}</p>
            </Card>
          ) : (
            recipes.map((r, i) => {
              const urgent = soon.filter((s) => r.uses.some((u) => normalizeName(u).includes(normalizeName(s.name)) || normalizeName(s.name).includes(normalizeName(u)))).map((s) => s.name);
              return (
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
                  {urgent.length > 0 && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-warn">
                      <Clock size={12} />
                      {t("Süresi yaklaşanı kullanır: {names}", { names: urgent.join(", ") })}
                    </p>
                  )}
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
              );
            })
          )}
          <p className="text-xs text-muted">{t("Besin değerleri yapay zekâ tahminidir. Alerjiniz varsa malzemeleri her zaman kendiniz kontrol edin.")}</p>
        </>
      )}

      {/* Ürün ekle */}
      {scanned ? (
        <Card className="space-y-3">
          <h2 className="font-semibold">{t("Okunan ürünler")}</h2>
          <p className="text-xs text-muted">{t("{place} için bulunan ürünler. Yanlış olanı çıkarın, sonra envantere kaydedin.", { place: locLabel[loc] })}</p>
          <ul className="space-y-2">
            {scanned.map((s, i) => (
              <li key={i} className="flex items-center gap-2">
                <Input value={s.name} maxLength={80} aria-label={t("Ürün adı")} onChange={(e) => setScanned((cur) => cur && cur.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <span className="w-20 shrink-0 text-right text-xs text-muted">{s.expires_on ? s.expires_on.split("-").reverse().join(".") : s.shelf_days != null ? t("~{n} gün", { n: s.shelf_days }) : "–"}</span>
                <button type="button" aria-label={t("{name} ürününü çıkar", { name: s.name })} onClick={() => setScanned((cur) => cur && cur.filter((_, j) => j !== i))} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:text-danger">
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">{t("Tarih, paketin üzerinde okunabildiyse gösterilir; yoksa tahmini saklama süresi (~gün) kullanılır.")}</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setScanned(null)}>
              {t("Vazgeç")}
            </Button>
            <Button className="flex-1" disabled={!scanned.some((s) => s.name.trim())} onClick={() => saveScanned(scanned.filter((s) => s.name.trim()))}>
              {t("Envantere kaydet")}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
              <Refrigerator size={22} />
            </span>
            <div>
              <h2 className="font-semibold">{t("Ürün ekle")}</h2>
              <p className="text-sm text-muted">{t("Önce nereyi çektiğinizi seçin, sonra fotoğraf çekin. Her rafı ayrı çekebilirsiniz.")}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label={t("Konum")}>
            {LOCATIONS.map((l) => {
              const Icon = LOC_ICON[l];
              return (
                <Chip key={l} active={loc === l} onClick={() => setLoc(l)}>
                  <Icon size={14} className="mr-1 inline" />
                  {locLabel[l]}
                </Chip>
              );
            })}
          </div>

          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void addPhoto(e.target.files?.[0]); e.target.value = ""; }} />
          <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => { void addPhoto(e.target.files?.[0]); e.target.value = ""; }} />

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{t("Fotoğraflar")}</span>
              <span className="tabular-nums text-muted">{photos.length} / {MAX_PHOTOS}</span>
            </div>
            <ul className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <li key={i} className="relative h-20 w-20 overflow-hidden rounded-xl border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.dataUrl} alt={t("Seçilen fotoğraf {n}", { n: i + 1 })} className="h-full w-full object-cover" />
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[10px] text-white">{i + 1}</span>
                  <button type="button" aria-label={t("Fotoğrafı kaldır")} onClick={() => setPhotos((cur) => cur.filter((_, j) => j !== i))} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white">
                    <X size={14} />
                  </button>
                </li>
              ))}
              {photos.length < MAX_PHOTOS && (
                <li>
                  <button type="button" disabled={!aiReady} onClick={() => cameraRef.current?.click()} className="grid h-20 w-20 place-items-center rounded-xl border-2 border-dashed border-border text-muted disabled:opacity-50">
                    <span className="flex flex-col items-center gap-1 text-[11px] font-medium">
                      <Plus size={20} />
                      {t("Fotoğraf ekle")}
                    </span>
                  </button>
                </li>
              )}
            </ul>
            {photos.length > 0 && photos.length < MAX_PHOTOS && <p className="text-xs text-muted">{t("Fotoğraf eklendi. Başka bir raf için “Fotoğraf ekle”ye basın ya da aşağıdan ürünleri okutun.")}</p>}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" disabled={!aiReady || photos.length >= MAX_PHOTOS} onClick={() => cameraRef.current?.click()}>
                <Camera size={18} />
                {t("Fotoğraf çek")}
              </Button>
              <Button variant="secondary" disabled={!aiReady || photos.length >= MAX_PHOTOS} onClick={() => galleryRef.current?.click()}>
                <ImageIcon size={18} />
                {t("Galeriden seç")}
              </Button>
            </div>
            <Button className="w-full" size="lg" loading={busy === "scan"} disabled={!aiReady || photos.length === 0 || busy !== null} onClick={scan}>
              <RefreshCw size={16} />
              {photos.length ? t("Ürünleri oku ({n} fotoğraf)", { n: photos.length }) : t("Ürünleri oku")}
            </Button>
            <p className="text-xs text-muted">{t("Fotoğraflar yalnızca ürünleri okumak için gönderilir ve hesabınıza kaydedilmez. Paketin üzerindeki son tüketim tarihi okunabiliyorsa kullanılır.")}</p>
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            <label htmlFor="fridge-typed" className="text-sm font-medium">
              {t("Ya da ürünleri yazın")}
            </label>
            <Textarea id="fridge-typed" rows={2} value={typed} maxLength={600} placeholder={t("yumurta, domates, beyaz peynir, makarna")} onChange={(e) => setTyped(e.target.value)} />
            <Button variant="secondary" className="w-full" disabled={!typedList.length} onClick={() => saveScanned(typedList.map((name) => ({ name, expires_on: null, shelf_days: null })))}>
              <Plus size={16} />
              {t("Yazdıklarımı envantere ekle")}
            </Button>
          </div>
        </Card>
      )}

      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={t("Ürünü düzenle")}
        footer={
          editing && (
            <div className="flex gap-2">
              <Button variant="secondary" className="text-danger" onClick={() => remove(editing)}>
                {t("Tükettim / kaldır")}
              </Button>
              <Button className="flex-1" onClick={saveEdit}>
                {t("Kaydet")}
              </Button>
            </div>
          )
        }
      >
        {editing && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="pantry-name" className="text-sm font-medium">{t("Ürün adı")}</label>
              <Input id="pantry-name" value={editing.name} maxLength={80} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("Konum")}>
              {LOCATIONS.map((l) => (
                <Chip key={l} active={editing.location === l} onClick={() => setEditing({ ...editing, location: l })}>
                  {locLabel[l]}
                </Chip>
              ))}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="pantry-exp" className="text-sm font-medium">{t("Son tüketim tarihi")}</label>
              <Input
                id="pantry-exp"
                type="date"
                value={editing.expires_on ?? ""}
                onChange={(e) => setEditing({ ...editing, expires_on: e.target.value || null, expiry_source: e.target.value ? "user" : "estimate" })}
              />
              <p className="text-xs text-muted">{editing.expires_on ? t("Boş bırakırsanız tahmini saklama süresi kullanılır.") : editing.shelf_days != null ? t("Tarih girilmedi; tahmini saklama süresi: {n} gün.", { n: editing.shelf_days }) : t("Tarih girmezseniz süre takibi yapılmaz.")}</p>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
