import type { Lang } from "../types";

export type RecipeTag = "high_protein" | "low_cal" | "low_sugar" | "low_salt" | "low_fat" | "high_fiber" | "quick";

export interface Recipe {
  id: string;
  name: Record<Lang, string>;
  tags: RecipeTag[];
  /** Bir porsiyon için yaklaşık değerler. */
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  minutes: number;
  /** Profildeki alerji anahtarlarıyla eşleşir. */
  allergens: string[];
  vegetarian: boolean;
  vegan: boolean;
  ingredients: Record<Lang, string[]>;
  steps: Record<Lang, string>;
}

/**
 * BKNY tarif kitaplığı: evde kolay yapılan, Türk mutfağına yakın tarifler.
 * Besin değerleri referans tablodaki malzemelerden hesaplanmış yaklaşık porsiyon değerleridir.
 */
export const RECIPES: Recipe[] = [
  {
    id: "yogurt-bowl", name: { tr: "Süzme yoğurtlu yulaf kasesi", en: "Strained yogurt & oat bowl" }, tags: ["high_protein", "quick", "high_fiber"],
    kcal: 330, protein_g: 26, carbs_g: 38, fat_g: 9, minutes: 5, allergens: ["lactose", "gluten", "tree_nuts"], vegetarian: true, vegan: false,
    ingredients: { tr: ["200 g süzme yoğurt", "30 g yulaf ezmesi", "1 küçük muz", "10 g ceviz"], en: ["200 g strained yogurt", "30 g rolled oats", "1 small banana", "10 g walnuts"] },
    steps: { tr: "Yoğurdu kaseye alın, yulafı karıştırın, üzerine muz dilimleri ve cevizi ekleyin.", en: "Spoon the yogurt into a bowl, stir in the oats and top with banana slices and walnuts." },
  },
  {
    id: "menemen-lor", name: { tr: "Lorlu menemen", en: "Menemen with curd cheese" }, tags: ["high_protein", "quick", "low_sugar"],
    kcal: 290, protein_g: 24, carbs_g: 10, fat_g: 17, minutes: 12, allergens: ["egg", "lactose"], vegetarian: true, vegan: false,
    ingredients: { tr: ["2 yumurta", "80 g lor peyniri", "1 domates", "1 yeşil biber", "1 tatlı kaşığı zeytinyağı"], en: ["2 eggs", "80 g lor (curd cheese)", "1 tomato", "1 green pepper", "1 tsp olive oil"] },
    steps: { tr: "Biberi yağda soteleyin, domatesi ekleyip pişirin, yumurta ve loru ekleyip karıştırarak 2–3 dakika pişirin.", en: "Soften the pepper in the oil, add the tomato and cook down, then stir in the eggs and curd cheese for 2–3 minutes." },
  },
  {
    id: "chicken-bulgur", name: { tr: "Izgara tavuklu bulgur tabağı", en: "Grilled chicken & bulgur plate" }, tags: ["high_protein", "high_fiber", "low_sugar"],
    kcal: 460, protein_g: 45, carbs_g: 40, fat_g: 12, minutes: 25, allergens: ["gluten"], vegetarian: false, vegan: false,
    ingredients: { tr: ["130 g tavuk göğsü", "150 g bulgur pilavı", "Bol yeşillikli salata", "1 tatlı kaşığı zeytinyağı, limon"], en: ["130 g chicken breast", "150 g cooked bulgur", "Large green salad", "1 tsp olive oil, lemon"] },
    steps: { tr: "Tavuğu baharatlayıp ızgarada pişirin. Bulgur ve limonlu salatayla servis edin.", en: "Season and grill the chicken. Serve with the bulgur and a lemon-dressed salad." },
  },
  {
    id: "tuna-salad", name: { tr: "Ton balıklı nohut salatası", en: "Tuna & chickpea salad" }, tags: ["high_protein", "quick", "high_fiber", "low_sugar"],
    kcal: 380, protein_g: 34, carbs_g: 26, fat_g: 15, minutes: 8, allergens: ["fish"], vegetarian: false, vegan: false,
    ingredients: { tr: ["1 kutu (80 g) süzülmüş ton balığı", "120 g haşlanmış nohut", "Domates, salatalık, maydanoz", "1 tatlı kaşığı zeytinyağı, limon"], en: ["1 can (80 g) drained tuna", "120 g cooked chickpeas", "Tomato, cucumber, parsley", "1 tsp olive oil, lemon"] },
    steps: { tr: "Tüm malzemeleri doğrayıp karıştırın, zeytinyağı ve limonla tatlandırın.", en: "Chop everything, toss together and dress with olive oil and lemon." },
  },
  {
    id: "lentil-soup", name: { tr: "Mercimek çorbası ve yoğurt", en: "Red lentil soup with yogurt" }, tags: ["high_fiber", "low_fat", "low_sugar", "low_cal"],
    kcal: 280, protein_g: 17, carbs_g: 40, fat_g: 6, minutes: 30, allergens: ["lactose"], vegetarian: true, vegan: false,
    ingredients: { tr: ["2 kase mercimek çorbası (500 ml)", "150 g yoğurt", "Limon, pul biber"], en: ["2 bowls red lentil soup (500 ml)", "150 g yogurt", "Lemon, chilli flakes"] },
    steps: { tr: "Mercimeği soğan ve havuçla haşlayıp blenderdan geçirin; az tuzla tatlandırın. Yanında yoğurtla servis edin.", en: "Simmer lentils with onion and carrot, blend smooth and season lightly. Serve with yogurt on the side." },
  },
  {
    id: "salmon-veg", name: { tr: "Fırında somon ve sebze", en: "Baked salmon with vegetables" }, tags: ["high_protein", "low_sugar", "low_salt"],
    kcal: 420, protein_g: 34, carbs_g: 14, fat_g: 25, minutes: 25, allergens: ["fish"], vegetarian: false, vegan: false,
    ingredients: { tr: ["150 g somon", "200 g brokoli ve havuç", "1 tatlı kaşığı zeytinyağı", "Limon, dereotu"], en: ["150 g salmon", "200 g broccoli and carrot", "1 tsp olive oil", "Lemon, dill"] },
    steps: { tr: "Somonu ve sebzeleri tepsiye dizin, yağ ve limon gezdirip 200°C fırında 18–20 dakika pişirin. Tuz yerine limon ve otlarla tatlandırın.", en: "Arrange salmon and vegetables on a tray, drizzle with oil and lemon and bake at 200°C for 18–20 minutes. Season with lemon and herbs instead of salt." },
  },
  {
    id: "kofte-salad", name: { tr: "Izgara köfte ve çoban salata", en: "Grilled kofte with shepherd's salad" }, tags: ["high_protein", "low_sugar"],
    kcal: 440, protein_g: 30, carbs_g: 16, fat_g: 28, minutes: 20, allergens: ["gluten"], vegetarian: false, vegan: false,
    ingredients: { tr: ["150 g ızgara köfte", "200 g çoban salata", "Közlenmiş biber"], en: ["150 g grilled kofte", "200 g shepherd's salad", "Roasted peppers"] },
    steps: { tr: "Köfteleri ızgarada pişirin; ekmek yerine bol salata ve közlenmiş biberle servis edin.", en: "Grill the kofte and serve with plenty of salad and roasted peppers instead of bread." },
  },
  {
    id: "egg-avocado", name: { tr: "Yumurtalı avokadolu tam buğday tost", en: "Egg & avocado wholewheat toast" }, tags: ["high_protein", "quick", "high_fiber", "low_sugar"],
    kcal: 350, protein_g: 19, carbs_g: 24, fat_g: 20, minutes: 8, allergens: ["egg", "gluten"], vegetarian: true, vegan: false,
    ingredients: { tr: ["2 haşlanmış yumurta", "1 dilim tam buğday ekmeği", "Yarım avokado", "Pul biber, limon"], en: ["2 boiled eggs", "1 slice wholewheat bread", "Half an avocado", "Chilli flakes, lemon"] },
    steps: { tr: "Avokadoyu ezip ekmeğe sürün, yumurtaları dilimleyip üzerine dizin.", en: "Mash the avocado onto the toast and top with sliced eggs." },
  },
  {
    id: "kuru-fasulye", name: { tr: "Kuru fasulye ve cacık", en: "White bean stew with cacik" }, tags: ["high_fiber", "low_sugar", "low_fat"],
    kcal: 390, protein_g: 23, carbs_g: 50, fat_g: 11, minutes: 15, allergens: ["lactose"], vegetarian: true, vegan: false,
    ingredients: { tr: ["250 g kuru fasulye yemeği", "150 g cacık", "Yeşil salata"], en: ["250 g white bean stew", "150 g cacik", "Green salad"] },
    steps: { tr: "Fasulyeyi az yağla pişirin; pilav yerine cacık ve salatayla tamamlayın.", en: "Cook the beans with little oil and pair with cacik and salad instead of rice." },
  },
  {
    id: "tofu-stirfry", name: { tr: "Sebzeli nohut–tofu sote", en: "Chickpea & tofu vegetable stir-fry" }, tags: ["high_protein", "high_fiber", "low_sugar"],
    kcal: 400, protein_g: 27, carbs_g: 34, fat_g: 17, minutes: 20, allergens: ["soy"], vegetarian: true, vegan: true,
    ingredients: { tr: ["150 g tofu", "100 g haşlanmış nohut", "Kabak, biber, mantar", "1 tatlı kaşığı zeytinyağı"], en: ["150 g tofu", "100 g cooked chickpeas", "Zucchini, pepper, mushrooms", "1 tsp olive oil"] },
    steps: { tr: "Tofuyu küp doğrayıp kızartın, sebzeleri ve nohudu ekleyip 6–7 dakika soteleyin.", en: "Brown the cubed tofu, add the vegetables and chickpeas and stir-fry for 6–7 minutes." },
  },
  {
    id: "green-lentil-salad", name: { tr: "Yeşil mercimek salatası", en: "Green lentil salad" }, tags: ["high_fiber", "low_fat", "low_sugar", "low_cal"],
    kcal: 300, protein_g: 18, carbs_g: 42, fat_g: 7, minutes: 10, allergens: [], vegetarian: true, vegan: true,
    ingredients: { tr: ["200 g haşlanmış yeşil mercimek", "Domates, taze soğan, maydanoz", "1 tatlı kaşığı zeytinyağı, nar ekşisi"], en: ["200 g cooked green lentils", "Tomato, spring onion, parsley", "1 tsp olive oil, pomegranate molasses"] },
    steps: { tr: "Mercimeği doğranmış sebzelerle karıştırın, zeytinyağı ve nar ekşisiyle tatlandırın.", en: "Toss the lentils with the chopped vegetables and dress with olive oil and pomegranate molasses." },
  },
  {
    id: "veg-omelette", name: { tr: "Ispanaklı omlet", en: "Spinach omelette" }, tags: ["high_protein", "quick", "low_cal", "low_sugar"],
    kcal: 250, protein_g: 20, carbs_g: 4, fat_g: 17, minutes: 8, allergens: ["egg"], vegetarian: true, vegan: false,
    ingredients: { tr: ["3 yumurta", "1 avuç ıspanak", "1 tatlı kaşığı zeytinyağı"], en: ["3 eggs", "1 handful of spinach", "1 tsp olive oil"] },
    steps: { tr: "Ispanağı yağda soldurun, çırpılmış yumurtayı ekleyip kısık ateşte pişirin.", en: "Wilt the spinach in the oil, pour over the beaten eggs and cook gently." },
  },
  {
    id: "ayran-snack", name: { tr: "Ayran ve bir avuç leblebi", en: "Ayran with roasted chickpeas" }, tags: ["quick", "low_sugar", "high_protein"],
    kcal: 190, protein_g: 12, carbs_g: 20, fat_g: 6, minutes: 1, allergens: ["lactose"], vegetarian: true, vegan: false,
    ingredients: { tr: ["1 bardak (200 ml) ayran", "30 g leblebi"], en: ["1 glass (200 ml) ayran", "30 g roasted chickpeas"] },
    steps: { tr: "Tatlı atıştırmalık yerine pratik, proteinli bir ara öğün.", en: "A quick protein snack to replace something sweet." },
  },
  {
    id: "fruit-yogurt", name: { tr: "Meyveli tarçınlı yoğurt", en: "Fruit & cinnamon yogurt" }, tags: ["low_cal", "quick", "low_fat"],
    kcal: 170, protein_g: 8, carbs_g: 26, fat_g: 5, minutes: 3, allergens: ["lactose"], vegetarian: true, vegan: false,
    ingredients: { tr: ["150 g yoğurt", "1 elma veya 1 kase çilek", "Tarçın"], en: ["150 g yogurt", "1 apple or a bowl of strawberries", "Cinnamon"] },
    steps: { tr: "Tatlı isteğinde şekerli tatlı yerine: meyveyi doğrayın, yoğurt ve tarçınla karıştırın.", en: "For sweet cravings instead of dessert: chop the fruit and mix with yogurt and cinnamon." },
  },
  {
    id: "zeytinyagli", name: { tr: "Zeytinyağlı taze fasulye ve yoğurt", en: "Green beans in olive oil with yogurt" }, tags: ["low_cal", "high_fiber", "low_sugar"],
    kcal: 260, protein_g: 10, carbs_g: 26, fat_g: 14, minutes: 15, allergens: ["lactose"], vegetarian: true, vegan: false,
    ingredients: { tr: ["250 g zeytinyağlı taze fasulye", "150 g yoğurt"], en: ["250 g green beans in olive oil", "150 g yogurt"] },
    steps: { tr: "Hafif bir akşam yemeği: fasulyeyi ılık ya da soğuk, yoğurtla servis edin.", en: "A light dinner: serve the beans warm or cold with yogurt." },
  },
  {
    id: "chicken-soup", name: { tr: "Sebzeli tavuk çorbası", en: "Chicken & vegetable soup" }, tags: ["low_cal", "low_fat", "high_protein", "low_sugar"],
    kcal: 220, protein_g: 24, carbs_g: 16, fat_g: 6, minutes: 30, allergens: [], vegetarian: false, vegan: false,
    ingredients: { tr: ["100 g haşlanmış tavuk", "Havuç, kabak, patates", "Limon, maydanoz"], en: ["100 g poached chicken", "Carrot, zucchini, potato", "Lemon, parsley"] },
    steps: { tr: "Sebzeleri tavuk suyunda yumuşayana kadar pişirin, didiklenmiş tavuğu ekleyin, limonla servis edin.", en: "Simmer the vegetables in the chicken stock until soft, add the shredded chicken and finish with lemon." },
  },
];

const DIET_FILTER: Record<string, (r: Recipe) => boolean> = {
  vegetarian: (r) => r.vegetarian,
  vegan: (r) => r.vegan,
  pescatarian: (r) => r.vegetarian || r.allergens.includes("fish"),
  gluten_free: (r) => !r.allergens.includes("gluten"),
};

/** Etikete uyan, kullanıcının alerji ve beslenme tercihlerine aykırı olmayan tarifler. */
export function pickRecipes(tag: RecipeTag, opts: { allergies?: string[]; diets?: string[]; maxKcal?: number; limit?: number } = {}): Recipe[] {
  const allergies = new Set(opts.allergies ?? []);
  const filters = (opts.diets ?? []).map((d) => DIET_FILTER[d]).filter(Boolean);
  const list = RECIPES.filter((r) => r.tags.includes(tag) && !r.allergens.some((a) => allergies.has(a)) && filters.every((f) => f(r)));
  const fitting = opts.maxKcal ? list.filter((r) => r.kcal <= opts.maxKcal!) : list;
  const pool = fitting.length ? fitting : list;
  const sorted = tag === "high_protein" ? [...pool].sort((a, b) => b.protein_g / b.kcal - a.protein_g / a.kcal) : tag === "low_cal" ? [...pool].sort((a, b) => a.kcal - b.kcal) : pool;
  return sorted.slice(0, opts.limit ?? 3);
}
