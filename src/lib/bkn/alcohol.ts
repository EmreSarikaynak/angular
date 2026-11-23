import { ETHANOL_KCAL, pureAlcoholGrams } from "../nutrition/drinks";

/** Alkollü ürün adlarını yakalayan (Türkçe + İngilizce) sözcükler. Öneri süzgeci ve sınıflandırma için kullanılır. */
const ALCOHOL_WORDS = [
  "alkol", "şarap", "sarap", "bira", "rakı", "raki", "votka", "viski", "whisky", "whiskey", "cin", "gin", "likör", "likor", "rom", "tekila", "konyak", "şampanya", "sampanya", "içki", "icki", "kırmızı şarap", "beyaz şarap", "sake", "brandy", "bourbon", "vermut", "vermouth", "absinthe", "sangria", "alcohol", "wine", "beer", "vodka", "rum", "liqueur", "champagne", "tequila", "cider", "elma şarabı", "malt", "ale", "lager", "stout", "prosecco",
];

const RE = new RegExp(`(^|[^\\p{L}])(${ALCOHOL_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})([^\\p{L}]|$)`, "iu");

/** Metin alkol içeren bir ürün/içecek/malzeme adı geçiriyor mu? ("alkolsüz" gibi olumsuzlar alkol sayılmaz.) */
export function mentionsAlcohol(text: string): boolean {
  const t = text.toLocaleLowerCase("tr");
  if (/(alkolsüz|alkolsuz|non-?alcoholic|alcohol-?free|0[.,]0\s*%)/u.test(t)) return false;
  return RE.test(t);
}

/**
 * Bir şişe/servis için tahmini kalori. Hacim ve alkol oranı biliniyorsa saf alkolün enerjisi (7 kcal/g)
 * asla atlanmaz: sonuç, modelin tahmini ile alkol enerjisinden büyük olandır.
 */
export function drinkKcal(volumeMl: number | null | undefined, abvPct: number | null | undefined, modelKcal: number | null | undefined): number | null {
  const alcohol = volumeMl && abvPct ? Math.round(pureAlcoholGrams(volumeMl, abvPct) * ETHANOL_KCAL) : 0;
  const model = modelKcal != null && Number.isFinite(modelKcal) ? Math.max(0, Math.round(modelKcal)) : null;
  if (model == null && !alcohol) return null;
  return Math.max(model ?? 0, alcohol);
}
