import type { Lang } from "../types";
import type { InsightKey } from "./insights";

export interface Notice {
  title: string;
  body: string;
  url: string;
}

type Vars = Record<string, string | number>;
const fill = (s: string, v: Vars) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
/** Aynı gün içinde farklı mesajlar gelsin diye sıra numarasına göre döner. */
const rotate = <T>(list: T[], n: number) => list[((n % list.length) + list.length) % list.length];

const WATER: Record<Lang, [string, string][]> = {
  tr: [
    ["Bir bardak su, bir küçük iyilik 💧", "Bugün kendin için ne yaptın? Hedefine {n} ml kaldı."],
    ["Su molası zamanı 💧", "Vücudun teşekkür edecek. Hedefe {n} ml var."],
    ["Kendine iyi bak 💧", "Bir bardak daha iç, {n} ml sonra hedef tamam."],
    ["Küçük adım, büyük fark 💧", "Şimdi bir bardak su iç; bugünkü hedefine {n} ml kaldı."],
  ],
  en: [
    ["A glass of water, a small kindness 💧", "What have you done for yourself today? {n} ml to go."],
    ["Time for a water break 💧", "Your body will thank you. {n} ml left to reach your goal."],
    ["Take care of yourself 💧", "One more glass — only {n} ml to go."],
    ["Small step, big difference 💧", "Have a glass of water now; {n} ml left for today."],
  ],
};

const SUPPLEMENT: Record<Lang, [string, string][]> = {
  tr: [
    ["Takviye zamanı ⏰", "{name}{dose} — kendine verdiğin sözü tut."],
    ["Bugün kendin için ne yaptın?", "{name}{dose} seni bekliyor. Bir dakikanı ayır."],
  ],
  en: [
    ["Supplement time ⏰", "{name}{dose} — keep the promise you made to yourself."],
    ["What have you done for yourself today?", "{name}{dose} is waiting. It only takes a minute."],
  ],
};

const SUPPLEMENT_NAG: Record<Lang, [string, string][]> = {
  tr: [
    ["Unutma, hâlâ vaktin var 💪", "{name}{dose} henüz işaretlenmedi. Şimdi al, aklın kalmasın."],
    ["Küçük bir hatırlatma 🌱", "{name}{dose} seni bekliyor. İstikrar, sonucu getirir."],
    ["Bugünü boş geçme ✨", "{name}{dose} — tek dokunuşla tamamla."],
  ],
  en: [
    ["Don't forget, there's still time 💪", "{name}{dose} hasn't been ticked off yet. Take it now and tick it off."],
    ["A gentle reminder 🌱", "{name}{dose} is still waiting. Consistency brings results."],
    ["Don't let today slip ✨", "{name}{dose} — one tap to complete."],
  ],
};

const PROTEIN: Record<Lang, [string, string][]> = {
  tr: [
    ["Protein hedefine {n} g kaldı 💪", "Öneri: {recipe}. Tarifler ve diğer fikirler seni bekliyor."],
    ["Günü güçlü bitir 💪", "Bugün {n} g protein eksik. {recipe} iyi bir seçenek olabilir."],
  ],
  en: [
    ["{n} g of protein to go 💪", "Idea: {recipe}. Recipes and more suggestions are waiting."],
    ["Finish the day strong 💪", "You're {n} g short on protein today. {recipe} could be a good pick."],
  ],
};

const INSIGHT: Record<Lang, Record<InsightKey, [string, string]>> = {
  tr: {
    protein_low: ["Son günlerde protein düşük", "{days} gündür ortalama {value} g (hedef {target} g). Sana uygun proteinli tarifler hazır."],
    kcal_high: ["Kalori hedefin üstünde gidiyor", "{days} gündür ortalama {value} kcal (hedef {target}). Hafif tarifler ve kısa bir yürüyüş dengeleyebilir."],
    kcal_low: ["Yeterince yemiyor olabilirsin", "{days} gündür ortalama {value} kcal (hedef {target}). Dengeli ve doyurucu öğün fikirlerine göz at."],
    sugar_high: ["Şeker son günlerde yüksek", "{days} gündür ortalama {value} g. Az şekerli atıştırmalık önerilerine bak."],
    salt_high: ["Tuz son günlerde yüksek", "{days} gündür ortalama {value} g (öneri en fazla {target} g). Az tuzlu tarifler hazır."],
    fat_high: ["Yağ hedefin üstünde", "{days} gündür ortalama {value} g (hedef {target} g). Hafif tarifleri dene."],
    fiber_low: ["Lif düşük kalıyor", "{days} gündür ortalama {value} g (öneri en az {target} g). Lifli tariflere göz at."],
    water_low: ["Su tüketimin düşük 💧", "{days} gündür ortalama {value} ml (hedef {target} ml). Bugün yanında bir şişe taşı."],
    steps_low: ["Biraz hareket iyi gelir 🚶", "{days} gündür ortalama {value} adım (hedef {target}). 15 dakikalık bir yürüyüşe ne dersin?"],
    sleep_low: ["Uykun azalmış görünüyor 🌙", "{days} gündür ortalama {value} saat. Bu akşam kendine erken bir yatış ayır."],
  },
  en: {
    protein_low: ["Protein has been low lately", "Averaging {value} g over {days} days (goal {target} g). High-protein recipes are ready for you."],
    kcal_high: ["Calories are running over goal", "Averaging {value} kcal over {days} days (goal {target}). Lighter recipes and a short walk can balance it."],
    kcal_low: ["You may not be eating enough", "Averaging {value} kcal over {days} days (goal {target}). Have a look at balanced, filling meal ideas."],
    sugar_high: ["Sugar has been high lately", "Averaging {value} g over {days} days. See the low-sugar snack ideas."],
    salt_high: ["Salt has been high lately", "Averaging {value} g over {days} days (suggested max {target} g). Low-salt recipes are ready."],
    fat_high: ["Fat is above your goal", "Averaging {value} g over {days} days (goal {target} g). Try the lighter recipes."],
    fiber_low: ["Fibre is staying low", "Averaging {value} g over {days} days (suggested min {target} g). Have a look at high-fibre recipes."],
    water_low: ["Your water intake is low 💧", "Averaging {value} ml over {days} days (goal {target} ml). Carry a bottle with you today."],
    steps_low: ["A bit of movement helps 🚶", "Averaging {value} steps over {days} days (goal {target}). How about a 15-minute walk?"],
    sleep_low: ["You seem to be sleeping less 🌙", "Averaging {value} h over {days} days. Give yourself an early night tonight."],
  },
};

export function waterNotice(lang: Lang, remainingMl: number, n: number): Notice {
  const [title, body] = rotate(WATER[lang], n);
  return { title, body: fill(body, { n: remainingMl }), url: "/water" };
}

export function supplementNotice(lang: Lang, name: string, dose: string | null, attempt: number): Notice {
  const [title, body] = attempt === 0 ? rotate(SUPPLEMENT[lang], name.length) : rotate(SUPPLEMENT_NAG[lang], attempt - 1);
  return { title, body: fill(body, { name, dose: dose ? ` (${dose})` : "" }), url: "/supplements" };
}

export function proteinNotice(lang: Lang, remainingG: number, recipe: string, n: number): Notice {
  const [title, body] = rotate(PROTEIN[lang], n);
  return { title: fill(title, { n: remainingG }), body: fill(body, { n: remainingG, recipe }), url: "/coach" };
}

export function insightNotice(lang: Lang, i: { key: InsightKey; value: number; target: number; days: number }): Notice {
  const [title, body] = INSIGHT[lang][i.key];
  return { title, body: fill(body, { value: Math.round(i.value), target: i.target, days: i.days }), url: "/coach" };
}

export function insightText(lang: Lang, i: { key: InsightKey; value: number; target: number; days: number }): { title: string; body: string } {
  const [title, body] = INSIGHT[lang][i.key];
  const v = i.key === "sleep_low" || i.key === "salt_high" ? Math.round(i.value * 10) / 10 : Math.round(i.value);
  return { title, body: fill(body, { value: v, target: i.target, days: i.days }) };
}

export function summaryNotice(lang: Lang, kind: "week" | "month"): Notice {
  const tr = kind === "week" ? ["Haftalık performansın hazır 📊", "Bu hafta kendin için neler yaptın? Özetine göz at."] : ["Aylık performans özetin hazır 📊", "Geçen ay kendin için neler yaptın? Özetini incele, indir."];
  const en = kind === "week" ? ["Your weekly performance is ready 📊", "What did you do for yourself this week? Have a look at your summary."] : ["Your monthly performance summary is ready 📊", "What did you do for yourself last month? Review and download your summary."];
  const [title, body] = lang === "en" ? en : tr;
  return { title, body, url: "/performance" };
}

/** Akşam kapanışı: günün kısa özeti. */
export function eveningNotice(lang: Lang, d: { meals: number; waterMl: number; waterTarget: number; proteinG: number; proteinTarget: number; supplementsLeft: number }): Notice {
  const title = lang === "en" ? "What have you done for yourself today? 🌙" : "Bugün kendin için ne yaptın? 🌙";
  if (d.meals === 0 && d.waterMl === 0) {
    return { title, body: lang === "en" ? "No entries yet today. A one-minute check-in is still a gift to yourself." : "Bugün henüz kayıt yok. Bir dakikalık kayıt bile kendine bir iyilik.", url: "/" };
  }
  const parts =
    lang === "en"
      ? [`${d.meals} meals logged`, `water ${d.waterMl}/${d.waterTarget} ml`, d.proteinTarget ? `protein ${d.proteinG}/${d.proteinTarget} g` : "", d.supplementsLeft > 0 ? `${d.supplementsLeft} supplement(s) left` : ""]
      : [`${d.meals} öğün kaydı`, `su ${d.waterMl}/${d.waterTarget} ml`, d.proteinTarget ? `protein ${d.proteinG}/${d.proteinTarget} g` : "", d.supplementsLeft > 0 ? `${d.supplementsLeft} takviye bekliyor` : ""];
  const tail = lang === "en" ? "Close the day in the app." : "Günü uygulamada tamamla.";
  return { title, body: `${parts.filter(Boolean).join(" · ")}. ${tail}`, url: "/" };
}

export function stockNotice(lang: Lang, name: string, daysLeft: number): Notice {
  return lang === "en"
    ? { title: "Supplement running low 📦", body: `${name}: about ${daysLeft} day(s) left. Time to restock.`, url: "/supplements" }
    : { title: "Takviyen azalıyor 📦", body: `${name}: yaklaşık ${daysLeft} günlük kaldı. Yenisini almayı unutma.`, url: "/supplements" };
}
