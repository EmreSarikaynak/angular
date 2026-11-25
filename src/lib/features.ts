/**
 * Özellik kataloğu ve plan kuralları (ücretsiz / Premium). Yapay zekâ özellikleri plana göre kısıtlanabilir ve yönetim
 * panelinden düzenlenir; uygulama içi diğer özellikler yalnızca bilgi amaçlı listelenir (sınırsız, herkese açık).
 */
export type Tier = "free" | "premium";
/** null = ek bir özellik limiti yok (yalnızca günlük genel YZ limiti geçerli); 0 = kapalı. */
export type Limit = number | null;

export interface FeatureConfig {
  /** "premium": yalnızca Premium üyeler kullanabilir. "free": herkes kullanabilir (limitlerle). */
  tier: Tier;
  free: Limit;
  premium: Limit;
}

export interface FeatureDef {
  key: string;
  label: string;
  description: string;
  /** ai_usage.kind değerleri; bu özelliğin kullanımı bu türlerin toplamıdır. */
  kinds: string[];
  defaults: FeatureConfig;
}

const open: FeatureConfig = { tier: "free", free: null, premium: null };

export const AI_FEATURES: FeatureDef[] = [
  { key: "food_photo", label: "Fotoğrafla yemek analizi", description: "Tabak fotoğrafından kalori ve besin değerleri", kinds: ["analyze_photo"], defaults: open },
  { key: "food_text", label: "Yazı / sesle yemek analizi", description: "Yazılan ya da söylenen öğünün analizi", kinds: ["analyze_text"], defaults: open },
  { key: "food_label", label: "Besin etiketi okuma", description: "Etiket fotoğrafından değerler ve içindekiler", kinds: ["analyze_label"], defaults: open },
  { key: "fridge", label: "Buzdolabından yemeğe", description: "Buzdolabı taraması ve yemek önerileri", kinds: ["fridge_scan", "fridge"], defaults: open },
  { key: "recipes", label: "Kişisel tarif önerileri", description: "Hedeflere göre tarifler", kinds: ["recipes"], defaults: open },
  { key: "meal_plan", label: "Haftalık öğün planı", description: "Plan ve alışveriş listesi", kinds: ["meal_plan"], defaults: open },
  { key: "menu", label: "Dışarıda yemek (menü)", description: "Menü fotoğrafından öneri", kinds: ["menu"], defaults: open },
  { key: "rings", label: "Sağlık halkası okuma", description: "Aktivite halkası ekran görüntüsü", kinds: ["rings"], defaults: open },
  { key: "assistant", label: "Beslenme asistanı", description: "Sohbet", kinds: ["assistant"], defaults: open },
  { key: "weekly_letter", label: "Haftalık mektup", description: "Haftalık özet mektubu", kinds: ["weekly_letter"], defaults: open },
];

/** Yapay zekâ kullanmayan özellikler: herkese açık, sınırsız. (Plana göre kısıtlama uygulanmaz; bilgi amaçlıdır.) */
export const APP_FEATURES: { key: string; label: string; note?: string }[] = [
  { key: "barcode", label: "Barkod okuma", note: "Open Food Facts" },
  { key: "product_notes", label: "Ürün notları", note: "Kural tabanlı, içindekiler ve besin değerleri" },
  { key: "water", label: "Su ve içecek takibi" },
  { key: "supplements", label: "Takviye hatırlatmaları ve stok" },
  { key: "wellbeing", label: "Uyku, ruh hali, günlük not" },
  { key: "activity", label: "Adım ve aktivite kaydı" },
  { key: "body", label: "Vücut ölçümleri ve kilo hedefi" },
  { key: "fasting", label: "Aralıklı oruç ve Ramazan modu" },
  { key: "diary", label: "Günlük, istatistik ve performans özetleri" },
  { key: "export", label: "PDF/PNG paylaşım ve veri dışa aktarma" },
  { key: "dietitian", label: "Diyetisyen paylaşımı" },
  { key: "health_sync", label: "Apple Sağlık / Health Connect okuma" },
  { key: "reminders", label: "Bildirimler ve hatırlatmalar" },
  { key: "pantry", label: "Dolap envanteri ve son tüketim takibi" },
];

export type FeatureConfigMap = Record<string, Partial<FeatureConfig> | undefined>;

export function featureByKey(key: string): FeatureDef | undefined {
  return AI_FEATURES.find((f) => f.key === key);
}

export function featureForKind(kind: string): FeatureDef | undefined {
  return AI_FEATURES.find((f) => f.kinds.includes(kind));
}

const norm = (v: unknown, d: Limit): Limit => (v === null ? null : typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : d);

/** Yönetici ayarını (varsa) varsayılanlarla birleştirip eksiksiz bir yapılandırma döndürür. */
export function resolveFeature(def: FeatureDef, config: FeatureConfigMap | null | undefined): FeatureConfig {
  const c = config?.[def.key];
  return {
    tier: c?.tier === "premium" || c?.tier === "free" ? c.tier : def.defaults.tier,
    free: c && "free" in c ? norm(c.free, def.defaults.free) : def.defaults.free,
    premium: c && "premium" in c ? norm(c.premium, def.defaults.premium) : def.defaults.premium,
  };
}

export type Verdict = { ok: true; limit: Limit } | { ok: false; reason: "premium_required" | "feature_limit"; limit: number };

/** Kullanıcının bu özelliği şimdi kullanıp kullanamayacağı. `usedToday`: bugün bu özellik için yapılan çağrı sayısı. */
export function checkFeature(cfg: FeatureConfig, premium: boolean, usedToday: number): Verdict {
  if (cfg.tier === "premium" && !premium) return { ok: false, reason: "premium_required", limit: 0 };
  const limit = premium ? cfg.premium : cfg.free;
  if (limit != null && usedToday >= limit) return { ok: false, reason: "feature_limit", limit };
  return { ok: true, limit };
}
