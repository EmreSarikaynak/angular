import Link from "next/link";
import { Logo } from "@/components/logo";
import { SITE_URL } from "@/lib/site";

type Copy = {
  lang: "tr" | "en";
  h1: string;
  lead: string;
  cta: string;
  login: string;
  featuresTitle: string;
  features: { title: string; text: string }[];
  stepsTitle: string;
  steps: { title: string; text: string }[];
  privacyTitle: string;
  privacy: string;
  disclaimer: string;
  privacyLink: string;
  other: { href: string; label: string };
  jsonLd: { description: string };
};

export const COPY: Record<"tr" | "en", Copy> = {
  tr: {
    lang: "tr",
    h1: "Bugün kendin için ne yaptın?",
    lead: "BKNY; yemeğinin fotoğrafını çekince besin değerini tahmin eden, su, takviye, uyku, hareket ve hedeflerini tek yerden takip etmeni sağlayan Türkçe, yapay zekâ destekli bir beslenme ve yaşam takip uygulamasıdır.",
    cta: "Ücretsiz hesap oluştur",
    login: "Giriş yap",
    featuresTitle: "BKNY ile neler yapabilirsin?",
    features: [
      { title: "Fotoğrafla yemek analizi", text: "Tabağının fotoğrafını çek; kalori, protein, karbonhidrat, yağ, şeker, lif ve tuz tahmin edilsin. Yazarak, barkodla veya besin etiketi okutarak da ekleyebilirsin; tahminleri sen düzenlersin." },
      { title: "Su, içecek ve alkol", text: "Günlük su hedefi ve hatırlatmalar. Kahve, çay, gazlı ve alkollü içeceklerin kalorisi ile kafeini hesaba katılır." },
      { title: "Takviye hatırlatmaları", text: "Doz ve saatleri sen girersin; BKNY yalnızca hatırlatır, takviye veya doz önermez. Stok azalınca uyarır." },
      { title: "Kişisel hedefler", text: "Boy, kilo, hareket düzeyi ve hedefine göre günlük kalori, protein ve su hedefi; adım, uyku ve ruh hali kayıtları." },
      { title: "Buzdolabından yemeğe", text: "Buzdolabı, buzluk ve dolabının fotoğrafından ürünlerini çıkarır, son tüketim tarihi yaklaşanlara öncelik veren, alerjilerine ve tercihlerine uygun yemek önerileri sunar." },
      { title: "Plan, oruç ve Ramazan", text: "Haftalık öğün planı ve alışveriş listesi, aralıklı oruç takibi, Ramazan'da sahur ve iftara göre öğün dağılımı." },
      { title: "Özetler ve paylaşım", text: "Haftalık, aylık ve yıllık performans özetleri; PDF veya PNG olarak paylaşma. İstersen seçtiğin bölümleri diyetisyeninle paylaşırsın." },
      { title: "Her yerde, çevrimdışı da", text: "Telefonda ana ekrana ekleyerek uygulama gibi kullan. Çevrimdışıyken girdiğin kayıtlar bağlantı gelince eşitlenir. Türkçe ve İngilizce, açık ve koyu tema." },
    ],
    stepsTitle: "Nasıl çalışır?",
    steps: [
      { title: "Hesabını oluştur", text: "Boy, kilo ve hedefini gir; günlük hedeflerin otomatik hesaplansın." },
      { title: "Yediklerini kaydet", text: "Fotoğraf çek, yaz ya da barkod okut. Sonucu istediğin gibi düzenle." },
      { title: "İlerlemeni gör", text: "Günlük ve haftalık özetleri, hatırlatmaları ve önerileri takip et." },
    ],
    privacyTitle: "Gizlilik ve kontrol",
    privacy: "Verilerin sana aittir: istediğin an dışa aktarabilir ya da hesabını ve tüm verilerini uygulama içinden silebilirsin. Veriler şifreli bağlantıyla iletilir; reklam veya izleme yoktur. Ayrıntılar için gizlilik ve KVKK aydınlatma metnine bak.",
    disclaimer: "BKNY bir tıbbi cihaz değildir ve tıbbi tavsiye vermez. Besin değerleri yapay zekâ tahminidir ve hata içerebilir. Sağlık durumun, ilaç veya takviye kullanımın, hamileliğin ya da yeme bozukluğun varsa beslenme ve oruç konusunda hekimine veya diyetisyenine danış.",
    privacyLink: "Gizlilik ve KVKK",
    other: { href: "/en", label: "English" },
    jsonLd: { description: "Yapay zekâ destekli, Türkçe beslenme ve yaşam takip uygulaması: fotoğrafla yemek analizi, su, takviye, uyku, hareket ve hedef takibi." },
  },
  en: {
    lang: "en",
    h1: "What did you do for yourself today?",
    lead: "BKNY is an AI-assisted nutrition and wellbeing tracker: snap your meal to get an estimate of its nutrition, and follow water, supplements, sleep, activity and goals in one place, in Turkish or English.",
    cta: "Create a free account",
    login: "Sign in",
    featuresTitle: "What can you do with BKNY?",
    features: [
      { title: "Photo meal analysis", text: "Take a photo of your plate and get an estimate of calories, protein, carbs, fat, sugar, fibre and salt. Type it, scan a barcode or a nutrition label instead; you can edit every estimate." },
      { title: "Water, drinks and alcohol", text: "A daily water goal with reminders. Calories and caffeine from coffee, tea, soft drinks and alcoholic drinks are counted." },
      { title: "Supplement reminders", text: "You enter your own doses and times; BKNY only reminds you and never recommends supplements or doses. It warns you when stock runs low." },
      { title: "Personal goals", text: "Daily calorie, protein and water goals based on your height, weight, activity level and goal, plus steps, sleep and mood logs." },
      { title: "Fridge to meal", text: "Photograph your fridge, freezer and pantry to build an inventory, then get meal ideas that prioritise items close to their use-by date and respect your allergies and preferences." },
      { title: "Planning, fasting and Ramadan", text: "A weekly meal plan and shopping list, intermittent fasting tracking, and a Ramadan mode that splits your day into suhoor and iftar." },
      { title: "Summaries and sharing", text: "Weekly, monthly and yearly performance summaries you can share as PDF or PNG. Share selected sections with your dietitian if you wish." },
      { title: "Anywhere, even offline", text: "Add it to your phone's home screen to use it like an app. Entries made offline sync when you reconnect. Turkish and English, light and dark themes." },
    ],
    stepsTitle: "How it works",
    steps: [
      { title: "Create your account", text: "Enter your height, weight and goal; your daily targets are calculated for you." },
      { title: "Log what you eat", text: "Take a photo, type it or scan a barcode. Edit the result however you like." },
      { title: "See your progress", text: "Follow daily and weekly summaries, reminders and suggestions." },
    ],
    privacyTitle: "Privacy and control",
    privacy: "Your data is yours: export it any time, or delete your account and all data from within the app. Data travels over encrypted connections; there are no ads and no tracking. See the privacy notice for details.",
    disclaimer: "BKNY is not a medical device and does not give medical advice. Nutrient values are AI estimates and may contain errors. If you have a health condition, take medication or supplements, are pregnant or have an eating disorder, talk to your doctor or dietitian about nutrition and fasting.",
    privacyLink: "Privacy notice",
    other: { href: "/", label: "Türkçe" },
    jsonLd: { description: "AI-assisted nutrition and wellbeing tracker: photo meal analysis, water, supplements, sleep, activity and goal tracking, in Turkish and English." },
  },
};

/** Herkese açık, sunucuda üretilen tanıtım sayfası (arama motorları için içerik). */
export function Landing({ lang, path }: { lang: "tr" | "en"; path?: string }) {
  const c = COPY[lang];
  const url = `${SITE_URL}${path ?? (lang === "tr" ? "/tanitim" : "/en")}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "BKNY",
    url,
    description: c.jsonLd.description,
    applicationCategory: "HealthApplication",
    operatingSystem: "Web",
    inLanguage: ["tr", "en"],
    offers: { "@type": "Offer", price: "0", priceCurrency: "TRY" },
    publisher: { "@type": "Organization", name: "Secesta Software" },
  };
  return (
    <div className="mx-auto max-w-3xl px-5 py-10" lang={c.lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo size={44} />
          <span className="text-xl font-bold tracking-tight">BKNY</span>
        </div>
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href={c.other.href} hrefLang={c.other.label === "English" ? "en" : "tr"} className="text-muted underline">
            {c.other.label}
          </Link>
          <Link href="/login" className="text-primary">
            {c.login}
          </Link>
        </nav>
      </header>

      <main>
        <section className="py-12 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{c.h1}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted">{c.lead}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/register" className="inline-flex h-12 items-center rounded-xl bg-primary px-6 font-semibold text-white">
              {c.cta}
            </Link>
            <Link href="/login" className="inline-flex h-12 items-center rounded-xl bg-surface-2 px-6 font-semibold">
              {c.login}
            </Link>
          </div>
        </section>

        <section aria-labelledby="features">
          <h2 id="features" className="text-2xl font-bold tracking-tight">
            {c.featuresTitle}
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {c.features.map((f) => (
              <li key={f.title} className="rounded-2xl border border-border bg-surface p-4">
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted">{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="steps" className="mt-12">
          <h2 id="steps" className="text-2xl font-bold tracking-tight">
            {c.stepsTitle}
          </h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-3">
            {c.steps.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-border bg-surface p-4">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">{i + 1}</span>
                <h3 className="mt-2 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="privacy" className="mt-12">
          <h2 id="privacy" className="text-2xl font-bold tracking-tight">
            {c.privacyTitle}
          </h2>
          <p className="mt-3 text-sm text-muted">{c.privacy}</p>
          <p className="mt-3 rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn">{c.disclaimer}</p>
        </section>
      </main>

      <footer className="mt-12 border-t border-border pt-6 text-sm text-muted">
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/privacy" className="underline">
            {c.privacyLink}
          </Link>
          <Link href="/login" className="underline">
            {c.login}
          </Link>
          <Link href="/register" className="underline">
            {c.cta}
          </Link>
        </nav>
        <p className="mt-3">© 2026 Secesta Software</p>
      </footer>
    </div>
  );
}
