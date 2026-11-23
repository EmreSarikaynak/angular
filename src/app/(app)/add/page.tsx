"use client";
import { Fragment, Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, ArrowLeft, SlidersHorizontal, Barcode, CalendarDays, CalendarHeart, Camera, ChefHat, CircleDot, Droplets, GlassWater, Image as ImageIcon, Lightbulb, Mail, MessageCircle, Mic, Moon, PenLine, Pill, Ruler, ScanText, Square, Star, Timer, Trash2, Trophy, Type, Users, UtensilsCrossed } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { CustomizeSheet, useUiPrefs } from "@/components/customize";
import { visibleItems } from "@/lib/layout-prefs";
import { Review } from "@/components/review";
import { blankItem } from "@/components/item-fields";
import { Button, Card, Empty, Field, Input, NumberInput, PageHeader, Skeleton, Textarea } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { compressImage, takePendingPhoto, type CompressedImage } from "@/lib/image";
import { scaleNutrients, sumNutrients } from "@/lib/nutrition/calc";
import { toDateKey } from "@/lib/dates";
import { listen, speechSupported } from "@/lib/speech";
import { deleteRow, upsertRow } from "@/lib/data/store";
import { useFavorites } from "@/lib/data/hooks";
import type { AnalysisResult, EntrySource, Favorite, FoodItem, Meal } from "@/lib/types";
import { MEALS } from "@/lib/types";

type Mode = "hub" | "photo" | "text" | "barcode" | "label" | "favorites" | "manual";
interface Draft {
  source: EntrySource;
  name: string;
  items: FoodItem[];
  analysis: AnalysisResult | null;
  image: CompressedImage | null;
  version: number;
}
interface Product {
  code: string;
  per100: FoodItem;
  serving_g: number | null;
  serving_label: string | null;
}

const EXAMPLES = ["2 haşlanmış yumurta", "150 gram tavuk göğsü", "1 kase mercimek çorbası", "2 dilim ekmek", "1 bardak ayran", "1 porsiyon Adana kebap"];

function AddInner() {
  const { t, lang, online, config, refreshConfig, toast } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const paramMode = params.get("mode") as Mode | null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") ?? "") ? (params.get("date") as string) : toDateKey();
  const mealParam = params.get("meal") as Meal | null;
  const meal = mealParam && MEALS.includes(mealParam) ? mealParam : undefined;

  const [customizing, setCustomizing] = useState(false);
  const { prefs } = useUiPrefs();
  const [mode, setMode] = useState<Mode>(paramMode && ["photo", "text", "barcode", "label", "favorites", "manual"].includes(paramMode) ? paramMode : "hub");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [text, setText] = useState("");
  const [code, setCode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [amount, setAmount] = useState<number | null>(100);
  const [scanning, setScanning] = useState(true);
  const [fileKind, setFileKind] = useState<"photo" | "label">("photo");
  const favorites = useFavorites();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [stopFn, setStopFn] = useState<(() => void) | null>(null);
  const [canSpeak, setCanSpeak] = useState(false);
  useEffect(() => {
    setCanSpeak(speechSupported());
  }, []);
  useEffect(() => () => stopFn?.(), [stopFn]);

  /** Sesle kayıt: konuşma metne çevrilip yazı alanına eklenir. Kullanıcı dokunuşuyla başlatılmalıdır. */
  function toggleVoice() {
    if (listening) {
      stopFn?.();
      return;
    }
    setError(null);
    setListening(true);
    const stop = listen(lang, {
      final: (said) => said && setText((v) => (v.trim() ? `${v.trim()}, ${said}` : said)),
      interim: setInterim,
      end: (err) => {
        setListening(false);
        setInterim("");
        setStopFn(null);
        if (err === "not-allowed" || err === "service-not-allowed") setError(t("Mikrofon izni verilmedi. Tarayıcı ayarlarından izin verip tekrar deneyin."));
        else if (err && err !== "no-speech" && err !== "aborted") setError(t("Ses tanınamadı. Tekrar deneyin ya da yazarak girin."));
      },
    });
    setStopFn(() => stop);
  }

  const aiReady = online && config?.ai_available !== false;

  const fail = useCallback(
    (e: unknown) => {
      const codeStr = e instanceof ApiError ? e.code : ((e as Error).message ?? "");
      setError(errorText(codeStr, t));
    },
    [t],
  );

  const analyze = useCallback(
    async (kind: "photo" | "text" | "label", payload: { image?: CompressedImage; text?: string; hint?: string }, version = 0) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api<{ result: AnalysisResult }>("/api/ai/analyze", {
          body: { kind, lang, text: payload.text, hint: payload.hint, image: payload.image ? { data: payload.image.base64, mimeType: payload.image.mimeType } : undefined },
        });
        void refreshConfig();
        if (!res.result.is_food || res.result.items.length === 0) {
          setError(kind === "text" ? t("Yazdıklarınızda bir yiyecek veya içecek bulamadım. Daha açık yazmayı deneyin.") : kind === "label" ? t("Fotoğrafta besin etiketi bulunamadı.") : t("Fotoğrafta yiyecek bulunamadı. Farklı bir fotoğraf deneyin."));
          return;
        }
        setDraft({ source: kind, name: res.result.dish_name, items: res.result.items, analysis: res.result, image: payload.image ?? null, version: version + 1 });
      } catch (e) {
        fail(e);
      } finally {
        setBusy(false);
      }
    },
    [lang, refreshConfig, t, fail],
  );

  const onFile = useCallback(
    async (file: File | undefined, kind: "photo" | "label") => {
      if (!file) return;
      setMode(kind);
      setBusy(true);
      setError(null);
      try {
        const image = await compressImage(file);
        await analyze(kind, { image });
      } catch (e) {
        fail(e);
        setBusy(false);
      }
    },
    [analyze, fail],
  );

  // Ana sayfadaki kamera düğmesinden gelen fotoğraf.
  useEffect(() => {
    const p = takePendingPhoto();
    if (p) void onFile(p.file, p.kind);
  }, [onFile]);

  function pick(kind: "photo" | "label", from: "camera" | "gallery") {
    setFileKind(kind);
    document.getElementById(from === "camera" ? "bt-camera-input" : "bt-gallery-input")?.click();
  }

  async function lookup(barcode: string) {
    setBusy(true);
    setError(null);
    setScanning(false);
    setCode(barcode);
    try {
      const res = await api<{ product: Product }>(`/api/barcode/${barcode}`);
      setProduct(res.product);
      setAmount(res.product.serving_g ?? 100);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setDraft(null);
    setError(null);
    setProduct(null);
    setScanning(true);
    setMode("hub");
  }

  const fileInputs = (
    <>
      <input id="bt-camera-input" type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void onFile(e.target.files?.[0], fileKind); e.target.value = ""; }} />
      <input id="bt-gallery-input" type="file" accept="image/*" hidden onChange={(e) => { void onFile(e.target.files?.[0], fileKind); e.target.value = ""; }} />
    </>
  );

  const back = (
    <button type="button" onClick={reset} aria-label={t("Geri")} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2">
      <ArrowLeft size={18} />
    </button>
  );

  if (draft) {
    return (
      <div>
        <PageHeader title={draft.name || t("Kaydı onayla")} subtitle={t("Değerleri kontrol edin, gerekirse düzeltin.")} back={back} />
        <Review
          key={draft.version}
          source={draft.source}
          initial={{ name: draft.name, items: draft.items }}
          analysis={draft.analysis}
          image={draft.image}
          date={date}
          meal={meal}
          onClarify={
            draft.source === "photo" || draft.source === "text"
              ? (hint) => analyze(draft.source as "photo" | "text", { image: draft.image ?? undefined, text: draft.source === "text" ? text : undefined, hint }, draft.version)
              : undefined
          }
          onSaved={(d) => router.push(`/diary?date=${d}`)}
          onCancel={reset}
        />
        {error && <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      </div>
    );
  }

  const errorBox = error && (
    <div role="alert" className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
      {error}
    </div>
  );
  const aiNotice = !aiReady && (
    <p className="rounded-xl bg-warn/10 px-3 py-2.5 text-sm text-warn">{!online ? t("Çevrimdışısınız. Yapay zekâ analizi için bağlantı gerekir; elle kayıt ve favoriler kullanılabilir.") : t("Yapay zekâ servisi şu anda kullanılamıyor. Elle kayıt ekleyebilirsiniz.")}</p>
  );

  if (mode === "photo" || mode === "label") {
    const isLabel = mode === "label";
    return (
      <div className="space-y-4">
        {fileInputs}
        <PageHeader title={isLabel ? t("Besin etiketi") : t("Fotoğrafla ekle")} back={back} />
        {busy ? (
          <Card className="flex flex-col items-center gap-3 py-10">
            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
            <p className="text-sm font-medium">{isLabel ? t("Etiket okunuyor…") : t("Fotoğraf analiz ediliyor…")}</p>
            <p className="text-xs text-muted">{t("Bu işlem birkaç saniye sürebilir.")}</p>
          </Card>
        ) : (
          <>
            {aiNotice}
            {errorBox}
            <Card className="space-y-3">
              <p className="text-sm text-muted">{isLabel ? t("Paketin üzerindeki besin değerleri tablosunun net bir fotoğrafını çekin.") : t("Tabağın tamamı görünecek şekilde, üstten ve iyi ışıkta çekin. Tabaktaki her yiyecek ayrı ayrı analiz edilir.")}</p>
              <div className="grid grid-cols-2 gap-3">
                <Button size="lg" disabled={!aiReady} onClick={() => pick(mode, "camera")}>
                  <Camera size={18} />
                  {t("Fotoğraf çek")}
                </Button>
                <Button size="lg" variant="secondary" disabled={!aiReady} onClick={() => pick(mode, "gallery")}>
                  <ImageIcon size={18} />
                  {t("Galeriden seç")}
                </Button>
              </div>
            </Card>
          </>
        )}
      </div>
    );
  }

  if (mode === "text") {
    return (
      <div className="space-y-4">
        <PageHeader title={t("Yazarak ekle")} back={back} />
        {aiNotice}
        {errorBox}
        <Card className="space-y-3">
          <Field label={t("Ne yediniz?")} hint={t("Her satıra ya da virgülle ayırarak birden fazla yiyecek yazabilirsiniz.")}>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={t("Örn. 2 haşlanmış yumurta, 2 dilim ekmek, 1 bardak ayran")} autoFocus={!listening} />
          </Field>
          {canSpeak ? (
            <Button variant={listening ? "danger" : "secondary"} className="w-full" aria-pressed={listening} onClick={toggleVoice}>
              {listening ? <Square size={16} /> : <Mic size={16} />}
              {listening ? t("Dinleniyor… durdurmak için dokunun") : t("Sesle söyle")}
            </Button>
          ) : (
            <p className="text-xs text-muted">{t("Bu tarayıcı sesle girişi desteklemiyor; klavyenizdeki mikrofon tuşunu kullanabilirsiniz.")}</p>
          )}
          {listening && interim && <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">{interim}</p>}
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => setText((v) => (v.trim() ? `${v.trim()}, ${ex}` : ex))} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">
                + {ex}
              </button>
            ))}
          </div>
          <Button size="lg" className="w-full" loading={busy} disabled={!text.trim() || !aiReady} onClick={() => analyze("text", { text: text.trim() })}>
            {t("Besin değerlerini hesapla")}
          </Button>
        </Card>
      </div>
    );
  }

  if (mode === "barcode") {
    return (
      <div className="space-y-4">
        <PageHeader title={t("Barkod okut")} back={back} />
        {errorBox}
        {!product && (
          <>
            {scanning && online && <BarcodeScanner onDetected={lookup} />}
            {!online && <p className="rounded-xl bg-warn/10 px-3 py-2.5 text-sm text-warn">{t("Barkod araması için internet bağlantısı gerekir.")}</p>}
            <Card className="space-y-3">
              <Field label={t("Barkod numarası")} hint={t("Kamera okuyamazsa barkodun altındaki numarayı yazın.")}>
                <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 14))} inputMode="numeric" placeholder="8690000000000" />
              </Field>
              <Button className="w-full" loading={busy} disabled={code.length < 8 || !online} onClick={() => lookup(code)}>
                {t("Ürünü bul")}
              </Button>
              {error && (
                <Button variant="secondary" className="w-full" onClick={() => { setError(null); setMode("label"); }}>
                  <ScanText size={16} />
                  {t("Besin etiketi fotoğrafı çek")}
                </Button>
              )}
            </Card>
          </>
        )}
        {product && (
          <Card className="space-y-3">
            <div>
              <p className="font-semibold">{product.per100.name}</p>
              <p className="text-xs text-muted">
                {t("100 g için")}: {product.per100.kcal} kcal · P {product.per100.protein_g} · K {product.per100.carbs_g} · Y {product.per100.fat_g}
              </p>
              <p className="mt-1 text-[11px] text-muted">{t("Kaynak: Open Food Facts")}</p>
            </div>
            <Field label={t("Tükettiğiniz miktar (g / ml)")} hint={product.serving_label ? t("Porsiyon: {s}", { s: product.serving_label }) : undefined}>
              <NumberInput value={amount} onChange={setAmount} min={1} max={5000} />
            </Field>
            <Button
              className="w-full"
              size="lg"
              disabled={!amount || amount <= 0}
              onClick={() => {
                const g = amount ?? 100;
                setDraft({ source: "barcode", name: product.per100.name, items: [{ ...scaleNutrients(product.per100, g / 100), grams: g, quantity: g, unit: "g" }], analysis: null, image: null, version: 1 });
              }}
            >
              {t("Devam")}
            </Button>
          </Card>
        )}
      </div>
    );
  }

  if (mode === "favorites") {
    const list = favorites.data ?? [];
    const pickFav = (f: Favorite) => {
      void upsertRow("favorites", { ...f, use_count: (f.use_count ?? 0) + 1 }).catch(() => {});
      setDraft({ source: "favorite", name: f.name, items: f.items, analysis: null, image: null, version: 1 });
    };
    return (
      <div className="space-y-3">
        <PageHeader title={t("Favoriler")} back={back} />
        {favorites.loading && !favorites.data ? (
          <Skeleton className="h-24" />
        ) : list.length === 0 ? (
          <Card>
            <Empty icon={<Star size={22} />} title={t("Henüz favoriniz yok")} text={t("Bir kaydı onaylarken “Favorilere ekle” seçeneğini işaretleyerek sık yediklerinizi tek dokunuşla ekleyebilirsiniz.")} />
          </Card>
        ) : (
          list.map((f) => {
            const n = sumNutrients(f.items);
            return (
              <Card key={f.id} className="flex items-center gap-3 p-3">
                <button type="button" onClick={() => pickFav(f)} className="min-w-0 flex-1 text-left">
                  <p className="truncate font-medium">{f.name}</p>
                  <p className="truncate text-xs text-muted">
                    {Math.round(n.kcal)} kcal · P {Math.round(n.protein_g)} · K {Math.round(n.carbs_g)} · Y {Math.round(n.fat_g)}
                  </p>
                </button>
                <button
                  type="button"
                  aria-label={t("Sil")}
                  onClick={async () => {
                    if (!confirm(t("Bu favori silinsin mi?"))) return;
                    await deleteRow("favorites", f.id).catch(() => toast(t("Silinemedi."), "error"));
                  }}
                  className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:text-danger"
                >
                  <Trash2 size={18} />
                </button>
              </Card>
            );
          })
        )}
      </div>
    );
  }

  const tile = (icon: React.ReactNode, title: string, sub: string, onClick: () => void, disabled = false, primary = false) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-opacity disabled:opacity-45 ${primary ? "border-primary bg-primary text-white" : "border-border bg-surface"}`}
    >
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${primary ? "bg-white/20" : "bg-primary-soft text-primary"}`}>{icon}</span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className={`block text-xs ${primary ? "text-white/80" : "text-muted"}`}>{sub}</span>
      </span>
    </button>
  );
  const link = (href: string, icon: React.ReactNode, title: string) => (
    <Link href={href} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-muted">{icon}</span>
      <span className="text-sm font-medium">{title}</span>
    </Link>
  );

  const tileItems = [
    { id: "camera", label: t("Fotoğraf çek"), icon: <Camera size={18} />, el: tile(<Camera size={20} />, t("Fotoğraf çek"), t("Yemeği kameradan analiz et"), () => pick("photo", "camera"), !aiReady, true) },
    { id: "gallery", label: t("Galeriden seç"), icon: <ImageIcon size={18} />, el: tile(<ImageIcon size={20} />, t("Galeriden seç"), t("Kayıtlı bir fotoğrafı yükle"), () => pick("photo", "gallery"), !aiReady) },
    ...(canSpeak ? [{ id: "voice", label: t("Sesle ekle"), icon: <Mic size={18} />, el: tile(<Mic size={20} />, t("Sesle ekle"), t("Ne yediğinizi söyleyin"), () => { setMode("text"); toggleVoice(); }, !aiReady) }] : []),
    { id: "text", label: t("Yazarak ekle"), icon: <Type size={18} />, el: tile(<Type size={20} />, t("Yazarak ekle"), t("“2 yumurta, 1 dilim ekmek”"), () => setMode("text"), !aiReady) },
    { id: "barcode", label: t("Barkod okut"), icon: <Barcode size={18} />, el: tile(<Barcode size={20} />, t("Barkod okut"), t("Paketli ürünler"), () => { setScanning(true); setMode("barcode"); }, !online) },
    { id: "label", label: t("Besin etiketi"), icon: <ScanText size={18} />, el: tile(<ScanText size={20} />, t("Besin etiketi"), t("Etiket fotoğrafını oku"), () => setMode("label"), !aiReady) },
    { id: "favorites", label: t("Favoriler"), icon: <Star size={18} />, el: tile(<Star size={20} />, t("Favoriler"), t("Sık yedikleriniz"), () => setMode("favorites")) },
    { id: "recipes", label: t("Tariflerim"), icon: <ChefHat size={18} />, el: tile(<ChefHat size={20} />, t("Tariflerim"), t("Kendi ev yemekleriniz"), () => router.push("/recipes")) },
    { id: "eating-out", label: t("Dışarıda yemek"), icon: <UtensilsCrossed size={18} />, el: tile(<UtensilsCrossed size={20} />, t("Dışarıda yemek"), t("Menü fotoğrafından öneri"), () => router.push("/eating-out"), !aiReady) },
    { id: "manual", label: t("Elle gir"), icon: <PenLine size={18} />, el: tile(<PenLine size={20} />, t("Elle gir"), t("Değerleri kendiniz yazın"), () => setDraft({ source: "manual", name: "", items: [blankItem()], analysis: null, image: null, version: 1 })) },
  ];
  const linkItems = [
    { id: "water", label: t("Su"), icon: <Droplets size={18} />, href: `/water?date=${date}` },
    { id: "drinks", label: t("İçecek"), icon: <GlassWater size={18} />, href: `/drinks?date=${date}` },
    { id: "activity", label: t("Aktivite"), icon: <Activity size={18} />, href: `/activity?date=${date}` },
    { id: "body", label: t("Kilo ve ölçüm"), icon: <Ruler size={18} />, href: "/body" },
    { id: "wellbeing", label: t("Uyku ve durum"), icon: <Moon size={18} />, href: `/wellbeing?date=${date}` },
    { id: "supplements", label: t("Takviyeler"), icon: <Pill size={18} />, href: `/supplements?date=${date}` },
    { id: "rings", label: t("Sağlık halkaları"), icon: <CircleDot size={18} />, href: `/rings?date=${date}` },
    { id: "fasting", label: t("Aralıklı oruç"), icon: <Timer size={18} />, href: "/fasting" },
    { id: "coach", label: t("Öneriler"), icon: <Lightbulb size={18} />, href: "/coach" },
    { id: "plan", label: t("Öğün planı"), icon: <CalendarDays size={18} />, href: "/plan" },
    { id: "letter", label: t("Haftalık mektup"), icon: <Mail size={18} />, href: "/letter" },
    { id: "challenges", label: t("Meydan okumalar"), icon: <Users size={18} />, href: "/challenges" },
    { id: "cycle", label: t("Döngü takibi"), icon: <CalendarHeart size={18} />, href: "/cycle" },
    { id: "performance", label: t("Performans"), icon: <Trophy size={18} />, href: "/performance" },
    { id: "assistant", label: t("Asistan"), icon: <MessageCircle size={18} />, href: "/assistant" },
  ];

  return (
    <div className="space-y-4">
      {fileInputs}
      <PageHeader
        title={t("Kayıt ekle")}
        subtitle={date !== toDateKey() ? date : undefined}
        action={
          <Button size="sm" variant="secondary" onClick={() => setCustomizing(true)}>
            <SlidersHorizontal size={16} />
            {t("Düzenle")}
          </Button>
        }
      />
      {aiNotice}
      {errorBox}
      <div className="grid grid-cols-2 gap-3">
        {visibleItems(tileItems, prefs["add.tiles"]).map((x) => (
          <Fragment key={x.id}>{x.el}</Fragment>
        ))}
      </div>
      <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("Diğer kayıtlar ve bölümler")}</p>
      <div className="grid grid-cols-2 gap-3">
        {visibleItems(linkItems, prefs["add.links"]).map((x) => (
          <Fragment key={x.id}>{link(x.href, x.icon, x.label)}</Fragment>
        ))}
      </div>
      <CustomizeSheet
        open={customizing}
        onClose={() => setCustomizing(false)}
        title={t("Seçenekleri düzenle")}
        groups={[
          { key: "add.tiles", title: t("Kayıt yöntemleri"), items: tileItems.map(({ id, label, icon }) => ({ id, label, icon })) },
          { key: "add.links", title: t("Diğer kayıtlar ve bölümler"), items: linkItems.map(({ id, label, icon }) => ({ id, label, icon })) },
        ]}
      />
    </div>
  );
}

export default function AddPage() {
  return (
    <Suspense>
      <AddInner />
    </Suspense>
  );
}
