/**
 * Ürün notları: etiketteki içindekiler listesi ve besin değerlerine dayanan, nesnel ve tarafsız uyarılar/olumlu notlar.
 *
 * Yazım ilkeleri (hukuki risk için): (1) yalnızca etikette yazan içeriğe ve genel kabul gören kurumların (DSÖ, EFSA, AB
 * mevzuatı, UK FSA etiket eşikleri) ölçütlerine dayanır; (2) marka, üretici ya da başka ürünle karşılaştırma yapmaz;
 * (3) "zararlı", "sağlıksız", "yemeyin" gibi mutlak ya da yargılayıcı ifade kullanmaz, "içeriyor", "sınırlı tüketim önerilir"
 * gibi olgusal ifadeler kullanır; (4) tıbbi tavsiye değildir ve ambalajdaki bilginin esas olduğunu belirtir.
 */
export type NoteLevel = "allergy" | "caution" | "info" | "benefit";
export interface ProductNote {
  code: string;
  level: NoteLevel;
  title: string;
  text: string;
}
export interface ProductInput {
  ingredients_text?: string | null;
  /** Open Food Facts katkı etiketleri (ör. "en:e250") veya E numaraları. */
  additives?: string[];
  /** Open Food Facts alerjen etiketleri (ör. "en:milk"). */
  allergens?: string[];
  traces?: string[];
  nova?: number | null;
  /** 100 g (sıvılarda 100 ml) için değerler; bilinmiyorsa besin eşiği notları verilmez. */
  per100?: { kcal: number; protein_g: number; fat_g: number; sat_fat_g?: number | null; sugar_g: number; fiber_g: number; salt_g: number } | null;
  liquid?: boolean;
  /** Kullanıcının profilindeki alerji anahtarları ya da serbest metinleri. */
  userAllergies?: string[];
}

/** Küçük harf + Türkçe/aksan katlama: "SÜT", "süt" ve "sut" aynı eşleşir. */
export function fold(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** İçindekiler listesini üst düzey virgüllerden böler (parantez içi bölünmez). */
export function splitIngredients(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of text) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    if ((ch === "," || ch === ";") && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const eNumbers = (text: string, tags: string[] = []): Set<string> => {
  const set = new Set<string>();
  for (const m of fold(text).matchAll(/\be[ -]?(\d{3,4}[a-i]?)\b/g)) set.add(`e${m[1]}`);
  for (const tag of tags) {
    const m = /e(\d{3,4}[a-i]?)$/i.exec(tag.trim());
    if (m) set.add(`e${m[1].toLowerCase()}`);
  }
  return set;
};
const hasE = (set: Set<string>, list: string[]) => list.filter((e) => set.has(e));
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => `e${a + i}`);

const SWEETENERS = ["e420", "e421", "e950", "e951", "e952", "e953", "e954", "e955", "e957", "e959", "e960", "e961", "e962", "e964", "e965", "e966", "e967", "e968", "e969"];
const SWEETENER_NAMES = /aspartam|asesulfam|acesulfam|sukraloz|sucralose|sakarin|saccharin|siklamat|cyclamate|stevia|steviol|ksilitol|xylitol|maltitol|sorbitol|eritritol|erythritol|izomalt|isomalt/;
const NITRITES = ["e249", "e250", "e251", "e252"];
const AZO_COLORS = ["e102", "e104", "e110", "e122", "e124", "e129"];
const AZO_NAMES = /tartrazin|kinolin sari|quinoline yellow|gun batimi|sunset yellow|azorubin|carmoisine|karmoizin|ponceau|ponso|allura/;
const SULPHITES = range(220, 228);

const PALM = /\bpalm(iye)?\b|palm ?(yagi|yag|kernel|oil|olein|cekirdek|stearin)|palmitat|palmiye/;
const HYDROGENATED = /hidrojen|hydrogenat/;
const PARTIAL = /kismen hidrojen|partially hydrogenat|part\.? hydrogenat/;
const SUGAR = /\b(seker|sugar|glikoz|glukoz|glucose|fruktoz|fructose|surup|syrup|dekstroz|dextrose|sakaroz|sucrose|maltoz|maltose|invert|honey|pekmez|molasses|izoglikoz|nisasta bazli)/;
const SUGAR_FREE = /sekersiz|sugar[- ]?free|no added sugar|seker ilavesiz|seker ilave edilmemis|unsweetened/;
const WHOLEGRAIN = /\btam (tahil|bugday|unlu)|\bbugday kepegi|whole ?(grain|wheat|meal)|wholemeal|\bintegral/;
const OLIVE = /zeytin ?yagi|olive oil/;

const ALLERGEN_PATTERNS: Record<string, RegExp> = {
  gluten: /\b(bugday|wheat|arpa|barley|cavdar|rye|gluten|malt|bulgur|irmik|semolina|durum|kamut|spelt|kuskus|couscous|makarna|yulaf|oats?)\b/,
  lactose: /\b(sut|milk|laktoz|lactose|peynir|cheese|yogurt|krema|cream|tereyag|butter|whey|kazein|casein|kefir|ayran|dairy|sut tozu)/,
  egg: /\b(yumurta|eggs?|albumin|ovalbumin|lizozim|lysozyme)\b/,
  peanut: /\b(yer fistig|peanuts?|arachis)|\bfistik ezmesi|(?<!antep )\bfistik\b/,
  tree_nuts: /\b(findik|badem|ceviz|antep fistig|kaju|hazelnuts?|almonds?|walnuts?|cashews?|pistachios?|pecans?|macadamia|kestane)/,
  fish: /\b(balik|fish|hamsi|somon|salmon|ton baligi|tuna|ancuez|anchov|morina|sardalya|sardine)/,
  shellfish: /\b(karides|yengec|istakoz|shrimp|prawns?|crab|lobster|midye|kalamar|mussels?|squid|oysters?|istiridye|mollus)/,
  soy: /\b(soya|soy|soja|soybeans?)\b/,
  sesame: /\b(susam|sesame|tahin|tahini)/,
};
const OFF_ALLERGEN_MAP: Record<string, string> = {
  "en:milk": "lactose",
  "en:gluten": "gluten",
  "en:nuts": "tree_nuts",
  "en:peanuts": "peanut",
  "en:eggs": "egg",
  "en:soybeans": "soy",
  "en:fish": "fish",
  "en:crustaceans": "shellfish",
  "en:molluscs": "shellfish",
  "en:sesame-seeds": "sesame",
};
const ALLERGEN_LABEL: Record<string, { tr: string; en: string }> = {
  gluten: { tr: "gluten", en: "gluten" },
  lactose: { tr: "süt / laktoz", en: "milk / lactose" },
  egg: { tr: "yumurta", en: "egg" },
  peanut: { tr: "yer fıstığı", en: "peanut" },
  tree_nuts: { tr: "kuruyemiş", en: "tree nuts" },
  fish: { tr: "balık", en: "fish" },
  shellfish: { tr: "kabuklu deniz ürünü", en: "shellfish" },
  soy: { tr: "soya", en: "soy" },
  sesame: { tr: "susam", en: "sesame" },
};

/** Bitkisel süt ve kakao yağı gibi yanlış eşleşmeleri ayıklar. */
const cleanForAllergens = (folded: string) =>
  folded
    .replace(/(badem|soya|yulaf|pirinc|findik|hindistan cevizi|kaju|almond|soy|oat|rice|coconut|cashew)\s+(sutu|milk|drink|icecegi)/g, " ")
    .replace(/kakao\s+(tere)?yagi|cocoa butter/g, " ")
    .replace(/patlican|eggplant/g, " ");

const num = (v: number | null | undefined) => (Number.isFinite(v) ? (v as number) : 0);
const fmt = (n: number, lang: "tr" | "en") => (Math.round(n * 10) / 10).toLocaleString(lang === "en" ? "en-GB" : "tr-TR");

/**
 * Ürün notlarını üretir. Sıra: alerji → dikkat → bilgi → olumlu.
 * `lang` yalnızca metin dilini seçer; kurallar dilden bağımsızdır.
 */
export function productNotes(input: ProductInput, lang: "tr" | "en"): ProductNote[] {
  const T = (tr: string, en: string) => (lang === "en" ? en : tr);
  const notes: ProductNote[] = [];
  const text = input.ingredients_text?.trim() ?? "";
  const f = fold(text);
  const hasText = f.length > 0;
  const e = eNumbers(text, input.additives);

  // ── Kullanıcının alerjileri ─────────────────────────────────────────────
  const contains = new Set<string>();
  const MAY = /(eser miktarda|iz miktarda|icerebilir|may contain|traces of)[^.;]*/g;
  const cleaned = cleanForAllergens(f.replace(MAY, " "));
  for (const [key, re] of Object.entries(ALLERGEN_PATTERNS)) if (re.test(cleaned)) contains.add(key);
  for (const tag of input.allergens ?? []) if (OFF_ALLERGEN_MAP[tag]) contains.add(OFF_ALLERGEN_MAP[tag]);
  const traces = new Set<string>();
  for (const tag of input.traces ?? []) if (OFF_ALLERGEN_MAP[tag]) traces.add(OFF_ALLERGEN_MAP[tag]);
  const mayContain = hasText ? f.match(MAY)?.join(" ") ?? "" : "";
  for (const [key, re] of Object.entries(ALLERGEN_PATTERNS)) if (mayContain && re.test(cleanForAllergens(mayContain))) traces.add(key);

  for (const raw of input.userAllergies ?? []) {
    const key = ALLERGEN_LABEL[raw] ? raw : null;
    const custom = key ? null : fold(raw).trim();
    const hit = key ? contains.has(key) : !!custom && f.includes(custom);
    const trace = key ? traces.has(key) && !contains.has(key) : false;
    const label = key ? ALLERGEN_LABEL[key][lang] : raw;
    if (hit) notes.push({ code: `allergy:${raw}`, level: "allergy", title: T(`Alerjiniz: ${label}`, `Your allergy: ${label}`), text: T(`Etiket bilgisine göre bu üründe ${label} bulunuyor. Alerjiniz nedeniyle tüketmeden önce ambalajı ve içindekileri kendiniz kontrol edin.`, `According to the label, this product contains ${label}. Because of your allergy, check the packaging and ingredients yourself before eating it.`) });
    else if (trace) notes.push({ code: `trace:${raw}`, level: "allergy", title: T(`${label} izi olabilir`, `May contain traces of ${label}`), text: T(`Etikette ${label} bakımından "iz miktarda içerebilir" türünde bir bilgi var. Duyarlılığınıza göre ambalajı kontrol edin.`, `The label carries a "may contain" statement for ${label}. Check the packaging according to your sensitivity.`) });
  }

  // ── Dikkat edilecekler ─────────────────────────────────────────────────
  if (hasText && PALM.test(f)) {
    notes.push({
      code: "palm_oil",
      level: "caution",
      title: T("Palm yağı içeriyor", "Contains palm oil"),
      text: T("İçindekiler arasında palm yağı yer alıyor. Palm yağı doymuş yağ bakımından zengindir; DSÖ doymuş yağ alımının günlük enerjinin %10'unun altında tutulmasını önerir. Dengeli beslenme içinde sınırlı tüketim düşünülebilir.", "Palm oil is listed in the ingredients. Palm oil is rich in saturated fat; the WHO recommends keeping saturated fat below 10% of daily energy. Limited consumption within a balanced diet may be considered."),
    });
  }
  if (hasText && HYDROGENATED.test(f)) {
    const partial = PARTIAL.test(f);
    notes.push({
      code: "hydrogenated",
      level: "caution",
      title: partial ? T("Kısmen hidrojene yağ içeriyor", "Contains partially hydrogenated fat") : T("Hidrojene yağ içeriyor", "Contains hydrogenated fat"),
      text: T("Kısmen hidrojene yağlar trans yağ kaynağı olabilir. DSÖ, trans yağ alımının mümkün olduğunca düşük tutulmasını önerir. Ambalajdaki besin değerleri tablosunu kontrol edin.", "Partially hydrogenated fats can be a source of trans fat. The WHO recommends keeping trans fat intake as low as possible. Check the nutrition table on the packaging."),
    });
  }
  if (hasText && SUGAR.test(f) && !SUGAR_FREE.test(f)) {
    const items = splitIngredients(f);
    const early = items.slice(0, 3).some((i) => SUGAR.test(i) && !SUGAR_FREE.test(i));
    notes.push({
      code: "added_sugar",
      level: "caution",
      title: T("Eklenmiş şeker içeriyor", "Contains added sugars"),
      text: T(`İçindekiler arasında şeker, şurup ya da benzeri bir tatlandırıcı madde var${early ? " ve ilk üç içerik arasında yer alıyor (içerikler miktara göre azalan sırayla yazılır)" : ""}. DSÖ, serbest şekerlerin günlük enerjinin %10'unun (mümkünse %5'inin) altında tutulmasını önerir.`, `Sugar, syrup or a similar sweetening ingredient is listed${early ? " and appears among the first three ingredients (ingredients are listed by descending weight)" : ""}. The WHO recommends keeping free sugars below 10% (ideally 5%) of daily energy.`),
    });
  }
  const sweet = hasE(e, SWEETENERS);
  if (hasText && (sweet.length || SWEETENER_NAMES.test(f))) {
    const names = sweet.map((x) => x.toUpperCase()).join(", ");
    notes.push({
      code: "sweeteners",
      level: "info",
      title: T("Tatlandırıcı içeriyor", "Contains sweeteners"),
      text: T(`İçindekiler arasında tatlandırıcı var${names ? ` (${names})` : ""}. Bu maddeler AB'de belirlenmiş güvenli günlük alım sınırlarıyla kullanılır. ${e.has("e951") ? "Aspartam fenilalanin kaynağıdır; fenilketonürisi olanlar dikkat etmelidir. " : ""}Tatlı tadına alışkanlığı azaltmak isteyenler için sınırlı tüketim düşünülebilir.`, `Sweeteners are listed${names ? ` (${names})` : ""}. These substances are used within acceptable daily intake limits set in the EU. ${e.has("e951") ? "Aspartame is a source of phenylalanine; people with phenylketonuria should take care. " : ""}Limited consumption may be considered if you want to reduce a taste for sweetness.`),
    });
  }
  if (hasText && (hasE(e, NITRITES).length || /nitrit|nitrat/.test(f))) {
    notes.push({
      code: "nitrites",
      level: "caution",
      title: T("Nitrit/nitrat içeriyor", "Contains nitrite/nitrate"),
      text: T("Genellikle işlenmiş et ürünlerinde kullanılan nitrit veya nitrat katkısı var. IARC işlenmiş eti Grup 1 (insanlar için kanserojen) olarak sınıflandırır; DSÖ işlenmiş et tüketiminin sınırlı tutulmasını önerir.", "A nitrite or nitrate additive, usually used in processed meat, is listed. IARC classifies processed meat in Group 1 (carcinogenic to humans); the WHO recommends limiting processed meat intake."),
    });
  }
  if (hasText && (hasE(e, AZO_COLORS).length || AZO_NAMES.test(f))) {
    notes.push({
      code: "azo_colors",
      level: "caution",
      title: T("Renklendirici içeriyor", "Contains colourings"),
      text: T(`İçindekiler arasında ${hasE(e, AZO_COLORS).map((x) => x.toUpperCase()).join(", ") || "bazı sentetik renklendiriciler"} bulunuyor. AB mevzuatı bu renklendiriciler için "çocuklarda aktivite ve dikkat üzerinde olumsuz etkisi olabilir" uyarısı ister.`, `The ingredients include ${hasE(e, AZO_COLORS).map((x) => x.toUpperCase()).join(", ") || "certain synthetic colourings"}. EU rules require the warning "may have an adverse effect on activity and attention in children" for these colourings.`),
    });
  }
  if (hasText && hasE(e, SULPHITES).length) {
    notes.push({ code: "sulphites", level: "info", title: T("Sülfit içeriyor", "Contains sulphites"), text: T("Sülfitler bazı duyarlı kişilerde (özellikle astımlılarda) tepki oluşturabilir; bu yüzden etiketlenmeleri zorunludur.", "Sulphites can cause reactions in some sensitive people (especially asthmatics), which is why they must be labelled.") });
  }
  if (typeof input.nova === "number" && input.nova === 4) {
    notes.push({ code: "nova4", level: "info", title: T("Çok işlenmiş gıda", "Ultra-processed food"), text: T("Open Food Facts sınıflamasına (NOVA 4) göre çok işlenmiş gıda grubunda. Bu gıdaların sık tüketiminin sınırlı tutulması genel bir beslenme önerisidir; sınıflama ürün listesine dayanır ve tek başına bir değerlendirme değildir.", "Under Open Food Facts' classification (NOVA 4) this is an ultra-processed food. Limiting frequent intake of such foods is general dietary advice; the classification is based on the ingredient list and is not an assessment on its own.") });
  }

  // ── Besin değerleri (100 g / 100 ml) ───────────────────────────────────
  const p = input.per100;
  if (p && (p.kcal > 0 || p.fat_g > 0 || p.sugar_g > 0 || p.salt_g > 0)) {
    const k = input.liquid ? 0.5 : 1; // sıvılar için yüksek eşikler yarıya iner (UK FSA)
    const unit = input.liquid ? "100 ml" : "100 g";
    const ref = T("Yaygın kullanılan renkli etiket eşiği", "Commonly used traffic-light threshold");
    const sat = p.sat_fat_g ?? null;
    if (num(p.salt_g) > 1.5 * k) notes.push({ code: "salt_high", level: "caution", title: T("Tuz oranı yüksek", "High in salt"), text: T(`${unit} için ${fmt(p.salt_g, lang)} g tuz. ${ref}: ${fmt(1.5 * k, lang)} g üzeri "yüksek". DSÖ yetişkinler için günde 5 g'dan az tuz önerir.`, `${fmt(p.salt_g, lang)} g salt per ${unit}. ${ref}: above ${fmt(1.5 * k, lang)} g is "high". The WHO recommends less than 5 g of salt a day for adults.`) });
    if (num(p.sugar_g) > 22.5 * k) notes.push({ code: "sugar_high", level: "caution", title: T("Şeker oranı yüksek", "High in sugars"), text: T(`${unit} için ${fmt(p.sugar_g, lang)} g şeker. ${ref}: ${fmt(22.5 * k, lang)} g üzeri "yüksek".`, `${fmt(p.sugar_g, lang)} g sugars per ${unit}. ${ref}: above ${fmt(22.5 * k, lang)} g is "high".`) });
    if (sat != null && sat > 5 * k) notes.push({ code: "satfat_high", level: "caution", title: T("Doymuş yağ oranı yüksek", "High in saturated fat"), text: T(`${unit} için ${fmt(sat, lang)} g doymuş yağ. ${ref}: ${fmt(5 * k, lang)} g üzeri "yüksek".`, `${fmt(sat, lang)} g saturated fat per ${unit}. ${ref}: above ${fmt(5 * k, lang)} g is "high".`) });
    if (num(p.fat_g) > 17.5 * k) notes.push({ code: "fat_high", level: "info", title: T("Yağ oranı yüksek", "High in fat"), text: T(`${unit} için ${fmt(p.fat_g, lang)} g yağ. ${ref}: ${fmt(17.5 * k, lang)} g üzeri "yüksek".`, `${fmt(p.fat_g, lang)} g fat per ${unit}. ${ref}: above ${fmt(17.5 * k, lang)} g is "high".`) });

    // ── Olumlu notlar (AB 1924/2006 beslenme beyanı eşikleri) ─────────────
    if (!input.liquid) {
      if (num(p.fiber_g) >= 6) notes.push({ code: "fiber_high", level: "benefit", title: T("Lif bakımından zengin", "High in fibre"), text: T(`100 g için ${fmt(p.fiber_g, lang)} g lif. AB'de "yüksek lifli" beyanı için eşik 6 g/100 g'dır. Lif sindirim sağlığına katkıda bulunur.`, `${fmt(p.fiber_g, lang)} g fibre per 100 g. In the EU the threshold for "high fibre" is 6 g/100 g. Fibre contributes to digestive health.`) });
      else if (num(p.fiber_g) >= 3) notes.push({ code: "fiber_source", level: "benefit", title: T("Lif kaynağı", "Source of fibre"), text: T(`100 g için ${fmt(p.fiber_g, lang)} g lif (AB'de "lif kaynağı" eşiği 3 g/100 g).`, `${fmt(p.fiber_g, lang)} g fibre per 100 g (the EU "source of fibre" threshold is 3 g/100 g).`) });
      const proteinShare = p.kcal > 0 ? ((p.protein_g * 4) / p.kcal) * 100 : 0;
      if (proteinShare >= 20) notes.push({ code: "protein_high", level: "benefit", title: T("Protein bakımından zengin", "High in protein"), text: T(`Enerjinin yaklaşık %${Math.round(proteinShare)}'i proteinden gelir (AB'de "yüksek proteinli" eşiği %20).`, `About ${Math.round(proteinShare)}% of the energy comes from protein (the EU "high protein" threshold is 20%).`) });
      else if (proteinShare >= 12) notes.push({ code: "protein_source", level: "benefit", title: T("Protein kaynağı", "Source of protein"), text: T(`Enerjinin yaklaşık %${Math.round(proteinShare)}'i proteinden gelir (AB'de "protein kaynağı" eşiği %12).`, `About ${Math.round(proteinShare)}% of the energy comes from protein (the EU "source of protein" threshold is 12%).`) });
      if (num(p.salt_g) > 0 && num(p.salt_g) <= 0.3) notes.push({ code: "salt_low", level: "benefit", title: T("Tuz oranı düşük", "Low in salt"), text: T(`100 g için ${fmt(p.salt_g, lang)} g tuz (AB'de "düşük sodyum" eşiği 0,3 g tuza karşılık gelir).`, `${fmt(p.salt_g, lang)} g salt per 100 g (the EU "low sodium" threshold corresponds to 0.3 g salt).`) });
    }
    if (num(p.sugar_g) <= (input.liquid ? 2.5 : 5) && (p.kcal > 0 || p.protein_g > 0)) notes.push({ code: "sugar_low", level: "benefit", title: T("Şeker oranı düşük", "Low in sugars"), text: T(`${unit} için ${fmt(p.sugar_g, lang)} g şeker (AB'de "düşük şekerli" eşiği ${input.liquid ? "2,5" : "5"} g).`, `${fmt(p.sugar_g, lang)} g sugars per ${unit} (the EU "low sugar" threshold is ${input.liquid ? "2.5" : "5"} g).`) });
  }

  if (hasText && WHOLEGRAIN.test(f)) notes.push({ code: "wholegrain", level: "benefit", title: T("Tam tahıl içeriyor", "Contains whole grain"), text: T("İçindekiler arasında tam tahıl yer alıyor; tam tahıllar lif ve mikro besin bakımından rafine tahıllardan zengindir.", "Whole grain is listed in the ingredients; whole grains are richer in fibre and micronutrients than refined grains.") });
  if (hasText && OLIVE.test(f)) notes.push({ code: "olive_oil", level: "benefit", title: T("Zeytinyağı içeriyor", "Contains olive oil"), text: T("Zeytinyağı tekli doymamış yağ bakımından zengindir; doymuş yağların yerine geçmesi genel beslenme önerilerinde yer alır.", "Olive oil is rich in monounsaturated fat; replacing saturated fats with it is part of general dietary advice.") });

  const order: Record<NoteLevel, number> = { allergy: 0, caution: 1, info: 2, benefit: 3 };
  return notes.sort((a, b) => order[a.level] - order[b.level]);
}

/** Her not bloğunun altında gösterilen çekince metni. */
export function notesDisclaimer(lang: "tr" | "en"): string {
  return lang === "en"
    ? "These notes are based on the ingredient list and nutrition values on the label and on general dietary guidance (WHO, EFSA, EU rules, UK FSA label thresholds). They do not assess any brand or product, are not medical advice, and may be incomplete or out of date; the information printed on the packaging prevails."
    : "Bu notlar, etiketteki içindekiler listesine ve besin değerlerine ile genel beslenme yönergelerine (DSÖ, EFSA, AB mevzuatı, UK FSA etiket eşikleri) dayanır. Belirli bir marka ya da ürünü değerlendirmez, tıbbi tavsiye değildir; eksik ya da güncel olmayabilir. Ambalajdaki bilgi esastır.";
}
