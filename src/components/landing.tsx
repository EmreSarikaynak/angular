import Link from "next/link";
import { Activity, Check, Camera, CalendarDays, ChevronDown, Droplets, Pill, Refrigerator, ScanBarcode, Share2, Target, Wifi } from "lucide-react";
import { InstallButtons } from "@/components/install-buttons";
import { Logo } from "@/components/logo";
import { Reveal } from "@/components/reveal";
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
  install: { title: string; text: string };
  gallery: string[];
  galleryTitle: string;
  badges: string[];
  faqTitle: string;
  faq: { q: string; a: string }[];
  finalTitle: string;
  finalText: string;
  article: { title: string; sections: { h: string; p: string }[] };
  plans: { title: string; free: { name: string; items: string[] }; premium: { name: string; items: string[] }; note: string };
  termsLink: string;
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
      { title: "Su ve içecekler", text: "Günlük su hedefi ve hatırlatmalar. Kahve, çay ve gazlı içeceklerin kalorisi ile kafeini hesaba katılır." },
      { title: "Takviye hatırlatmaları", text: "Doz ve saatleri sen girersin; BKNY yalnızca hatırlatır, takviye veya doz önermez. Stok azalınca uyarır." },
      { title: "Kişisel hedefler", text: "Boy, kilo, hareket düzeyi ve hedefine göre günlük kalori, protein ve su hedefi; adım, uyku ve ruh hali kayıtları." },
      { title: "Buzdolabından yemeğe", text: "Buzdolabı, buzluk ve dolabının fotoğrafından ürünlerini çıkarır, son tüketim tarihi yaklaşanlara öncelik veren, alerjilerine ve tercihlerine uygun yemek önerileri sunar." },
      { title: "Plan, oruç ve Ramazan", text: "Haftalık öğün planı ve alışveriş listesi, aralıklı oruç takibi, Ramazan'da sahur ve iftara göre öğün dağılımı." },
      { title: "Özetler ve paylaşım", text: "Haftalık, aylık ve yıllık performans özetleri; PDF veya PNG olarak paylaşma. İstersen seçtiğin bölümleri diyetisyeninle paylaşırsın." },
      { title: "Ürün notları", text: "Barkod okut ya da içindekiler yazısının fotoğrafını çek; palm yağı, eklenmiş şeker, tatlandırıcı, alerjen gibi içerikler ve yüksek/düşük besin değerleri, kaynaklı ve tarafsız notlarla gösterilsin." },
      { title: "Saat ve sağlık uygulaması", text: "Mobil uygulamada, izin verirsen Apple Sağlık veya Health Connect'ten adım, uyku ve antrenmanların yalnızca okunur; elle girmene gerek kalmaz." },
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
    install: { title: "Telefonuna ekle", text: "BKNY'yi ana ekrana ekle, uygulama gibi tek dokunuşla aç. Mağazadan indirmen gerekmez." },
    galleryTitle: "Uygulamadan görünümler",
    gallery: ["Günlük hedefler ve ilerleme özeti", "Fotoğraf, yazı ve barkodla kayıt ekleme", "Buzdolabından yemeğe: envanter ve öneriler", "Haftalık ve aylık istatistikler", "Beslenme asistanı sohbeti"],
    badges: ["Ücretsiz başla", "Reklamsız", "Türkçe ve İngilizce", "Çevrimdışı çalışır"],
    faqTitle: "Sık sorulan sorular",
    faq: [
      { q: "BKNY ücretsiz mi?", a: "Ücretsiz başlayabilirsin: hesap oluşturup temel özellikleri ve günde 20 yapay zekâ analizini kullanırsın. Günde 300'e kadar analiz ve haftalık öğün planı için isteğe bağlı BKNY Premium aboneliği vardır." },
      { q: "Premium aboneliği nasıl iptal edilir?", a: "Abonelik, mobil uygulamada Google Play ya da App Store üzerinden alınır; iptali de aynı mağazanın abonelik ayarlarından yapılır. İptal, mevcut dönemin sonunda geçerli olur." },
      { q: "Besin değerleri ne kadar doğru?", a: "Fotoğraf ve metinden yapılan değerler yapay zekâ tahminidir; her kalemi düzenleyebilirsin. Barkod ve etiket okuma, ambalajdaki değerlere dayanır." },
      { q: "Verilerimi silebilir miyim?", a: "Evet. Verilerini istediğin an dışa aktarabilir, hesabını ve tüm verilerini uygulama içinden silebilirsin." },
      { q: "Akıllı saatimle çalışır mı?", a: "Mobil uygulamada, izin verirsen Apple Sağlık veya Health Connect'e yansıyan adım, uyku ve antrenman verilerin okunur. Veriler reklam ya da üçüncü taraflarla paylaşılmaz." },
      { q: "Tıbbi tavsiye veriyor mu?", a: "Hayır. BKNY bir tıbbi cihaz değildir; sağlık durumunla ilgili kararlar için hekimine veya diyetisyenine danış." },
    ],
    plans: {
      title: "Ücretsiz başla, ihtiyacın olursa yüksel",
      free: { name: "Ücretsiz", items: ["Fotoğraf, yazı, barkod ve etiketle kayıt", "Günde 20 yapay zekâ analizi (fotoğraf 5, yazı 10, etiket 5, asistan 5)", "Su, takviye, uyku, hareket ve hedef takibi", "Özetler ve ürün notları"] },
      premium: { name: "BKNY Premium", items: ["Günde 300'e kadar yapay zekâ analizi (fotoğraf 100, yazı 200, asistan 100)", "Haftalık öğün planı; buzdolabı ve tarif önerilerinde çok daha yüksek limit", "Aylık ya da yıllık abonelik, istediğin zaman iptal", "Mobil uygulamadan satın alınır"] },
      note: "Fiyatlar mağazada gösterilir. Abonelik otomatik yenilenir; mağaza hesap ayarlarından iptal edebilirsin.",
    },
    termsLink: "Kullanım koşulları",
    finalTitle: "Bugün kendin için ilk adımı at",
    finalText: "Hesabını bir dakikada oluştur, ilk öğününü kaydet.",
    article: {
      title: "Bugün kendin için ne yaptın? Küçük soru, büyük alışkanlık",
      sections: [
        { h: "Neden bu soru?", p: "Sağlıklı beslenme çoğu zaman büyük kararlardan değil, gün içindeki küçük seçimlerden oluşur. \"Bugün kendin için ne yaptın?\" sorusu, günün sonunda kendine kısa bir hesap sorman için bir alışkanlık çerçevesi sunar: bir öğünü bilinçli seçtin mi, su içtin mi, biraz yürüdün mü, dinlendin mi?" },
        { h: "Kaydetmek farkındalık getirir", p: "Yediklerini ve içtiklerini yazmak ya da fotoğraflamak, tahmini bir bilinç oluşturur. BKNY'de tabağının fotoğrafını çekebilir, yazabilir, barkod ya da besin etiketi okutabilirsin; kalori, protein, karbonhidrat, yağ, şeker, lif ve tuz tahmini hesaplanır. Değerler yapay zekâ tahminidir; her kalemi düzenleyebilirsin." },
        { h: "Sadece yemek değil: su, uyku ve hareket", p: "Beslenme tek başına bir tablo değildir. Su, takviye hatırlatmaları, adım, uyku ve ruh hali kayıtları günlük resmi tamamlar. Haftalık ve aylık özetlerde bu alışkanlıkların birbiriyle ilişkisini görebilirsin." },
        { h: "Buzdolabını boşa harcama", p: "Buzdolabı, buzluk ve dolabının fotoğrafından ürünlerini çıkarır, son tüketim tarihi yaklaşanlara öncelik veren yemek önerileri sunar. Böylece hem israfı azaltır hem de ne pişireceğini düşünme yükünü hafifletirsin." },
        { h: "Ürün etiketini anlamak", p: "Barkod okuttuğunda ya da içindekiler listesinin fotoğrafını çektiğinde, palm yağı, eklenmiş şeker, tatlandırıcı veya alerjen gibi içerikler ile yüksek ya da düşük besin değerleri kaynaklı ve tarafsız notlarla gösterilir. Bu notlar bir ürünü ya da markayı değerlendirmez; karar sana aittir." },
        { h: "Sınırlar ve gizlilik", p: "BKNY bir tıbbi cihaz değildir ve tıbbi tavsiye vermez. Sağlık durumun, ilaç ya da takviye kullanımın, hamileliğin veya yeme bozukluğun varsa hekimine ya da diyetisyenine danış. Verilerini dışa aktarabilir, hesabını ve tüm verilerini istediğin an silebilirsin." },
      ],
    },
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
      { title: "Water and drinks", text: "A daily water goal with reminders. Calories and caffeine from coffee, tea and soft drinks are counted." },
      { title: "Supplement reminders", text: "You enter your own doses and times; BKNY only reminds you and never recommends supplements or doses. It warns you when stock runs low." },
      { title: "Personal goals", text: "Daily calorie, protein and water goals based on your height, weight, activity level and goal, plus steps, sleep and mood logs." },
      { title: "Fridge to meal", text: "Photograph your fridge, freezer and pantry to build an inventory, then get meal ideas that prioritise items close to their use-by date and respect your allergies and preferences." },
      { title: "Planning, fasting and Ramadan", text: "A weekly meal plan and shopping list, intermittent fasting tracking, and a Ramadan mode that splits your day into suhoor and iftar." },
      { title: "Summaries and sharing", text: "Weekly, monthly and yearly performance summaries you can share as PDF or PNG. Share selected sections with your dietitian if you wish." },
      { title: "Product notes", text: "Scan a barcode or photograph the ingredients list to see ingredients such as palm oil, added sugar, sweeteners and allergens, and high or low nutrient values, as neutral, sourced notes." },
      { title: "Watch and health app", text: "In the mobile app, if you allow it, steps, sleep and workouts are read from Apple Health or Health Connect, so you don't have to type them in." },
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
    install: { title: "Add it to your phone", text: "Add BKNY to your home screen and open it like an app in one tap. No store download needed." },
    galleryTitle: "A look inside the app",
    gallery: ["Daily goals and progress summary", "Logging with photo, text and barcode", "Fridge to meal: inventory and ideas", "Weekly and monthly statistics", "Nutrition assistant chat"],
    badges: ["Free to start", "No ads", "Turkish and English", "Works offline"],
    faqTitle: "Frequently asked questions",
    faq: [
      { q: "Is BKNY free?", a: "You can start for free: create an account and use the core features and 20 AI analyses a day. An optional BKNY Premium subscription gives you up to 300 analyses a day and the weekly meal plan." },
      { q: "How do I cancel Premium?", a: "The subscription is bought in the mobile app through Google Play or the App Store, and cancelled in that store's subscription settings. Cancellation takes effect at the end of the current period." },
      { q: "How accurate are the nutrient values?", a: "Values from photos and text are AI estimates, and you can edit every item. Barcode and label scans rely on the values printed on the package." },
      { q: "Can I delete my data?", a: "Yes. Export your data any time, or delete your account and all data from within the app." },
      { q: "Does it work with my smartwatch?", a: "In the mobile app, if you allow it, steps, sleep and workouts that appear in Apple Health or Health Connect are read. The data is not shared with advertisers or third parties." },
      { q: "Does it give medical advice?", a: "No. BKNY is not a medical device; for decisions about your health talk to your doctor or dietitian." },
    ],
    plans: {
      title: "Start free, upgrade if you need more",
      free: { name: "Free", items: ["Log with photo, text, barcode and label", "20 AI analyses a day (photo 5, text 10, label 5, assistant 5)", "Water, supplement, sleep, activity and goal tracking", "Summaries and product notes"] },
      premium: { name: "BKNY Premium", items: ["Up to 300 AI analyses a day (photo 100, text 200, assistant 100)", "Weekly meal plan; far higher limits for fridge and recipe ideas", "Monthly or yearly, cancel any time", "Bought in the mobile app"] },
      note: "Prices are shown in the store. The subscription renews automatically; you can cancel in your store account settings.",
    },
    termsLink: "Terms of use",
    finalTitle: "Take the first step for yourself today",
    finalText: "Create your account in a minute and log your first meal.",
    article: {
      title: "What did you do for yourself today? A small question, a big habit",
      sections: [
        { h: "Why this question?", p: "Healthy eating is rarely about big decisions; it is built from small daily choices. \"What did you do for yourself today?\" gives you a simple frame for a short check-in at the end of the day: did you choose a meal with intention, drink some water, take a walk, get some rest?" },
        { h: "Logging builds awareness", p: "Writing down or photographing what you eat and drink builds awareness. In BKNY you can photograph your plate, type it, or scan a barcode or nutrition label to get an estimate of calories, protein, carbs, fat, sugar, fibre and salt. Values are AI estimates and you can edit every item." },
        { h: "Not only food: water, sleep and movement", p: "Nutrition is never the whole picture. Water, supplement reminders, steps, sleep and mood logs complete your day. Weekly and monthly summaries help you see how these habits relate to each other." },
        { h: "Don't waste what's in your fridge", p: "Photograph your fridge, freezer and pantry to build an inventory, then get meal ideas that prioritise items close to their use-by date. It reduces waste and takes the 'what should I cook?' load off your mind." },
        { h: "Understanding a product label", p: "When you scan a barcode or photograph an ingredients list, ingredients such as palm oil, added sugar, sweeteners or allergens, and high or low nutrient values, are shown as neutral, sourced notes. They do not assess any product or brand; the decision is yours." },
        { h: "Limits and privacy", p: "BKNY is not a medical device and does not give medical advice. If you have a health condition, take medication or supplements, are pregnant or have an eating disorder, talk to your doctor or dietitian. You can export your data, or delete your account and all data, at any time." },
      ],
    },
  },
};

const FEATURE_ICONS = [Camera, Droplets, Pill, Target, Refrigerator, CalendarDays, Share2, ScanBarcode, Activity, Wifi];
const GALLERY = ["home", "add", "fridge", "stats", "assistant"];

/** Herkese açık, sunucuda üretilen tanıtım sayfası (arama motorları için içerik). Mobil öncelikli. */
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
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: c.article.title,
    inLanguage: c.lang,
    mainEntityOfPage: url,
    dateModified: "2026-11-24",
    author: { "@type": "Organization", name: "Secesta Software" },
    publisher: { "@type": "Organization", name: "Secesta Software" },
    articleBody: c.article.sections.map((x) => `${x.h}. ${x.p}`).join(" "),
  };
  const siteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "BKNY",
    alternateName: lang === "tr" ? ["Bugün kendin için ne yaptın?", "BKN"] : ["What did you do for yourself today?"],
    url: SITE_URL,
    inLanguage: ["tr", "en"],
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <div lang={c.lang} className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteLd) }} />
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-5">
          <div className="flex items-center gap-2.5">
            <Logo size={34} />
            <span className="text-lg font-bold tracking-tight">BKNY</span>
          </div>
          <nav className="flex items-center gap-2 text-sm font-medium">
            <Link href={c.other.href} hrefLang={c.other.label === "English" ? "en" : "tr"} className="px-2 py-2 text-muted">
              {c.other.label}
            </Link>
            <Link href="/login" className="inline-flex h-9 items-center rounded-full bg-primary-soft px-4 text-primary">
              {c.login}
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5">
        <section className="relative grid items-center gap-8 pb-8 pt-8 sm:pt-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:pb-14 lg:pt-16">
          <div aria-hidden className="pointer-events-none absolute -top-10 left-1/2 -z-10 h-72 w-[120%] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl lg:left-3/4 lg:h-96 lg:w-[60%]" />
          <div className="bt-hero-in text-center lg:text-left">
            <h1 className="text-balance text-[1.9rem] font-extrabold leading-[1.15] tracking-tight sm:text-5xl">{c.h1}</h1>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-muted sm:text-lg lg:mx-0">{c.lead}</p>
            <div className="mx-auto mt-6 flex max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center lg:justify-start">
              <Link href="/register" className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-7 font-semibold text-white shadow-md shadow-primary/25 active:scale-[.98]">
                {c.cta}
              </Link>
              <Link href="/login" className="inline-flex h-12 items-center justify-center rounded-xl bg-surface-2 px-7 font-semibold active:scale-[.98]">
                {c.login}
              </Link>
            </div>
            <ul className="mt-5 flex flex-wrap justify-center gap-2 lg:justify-start">
              {c.badges.map((b) => (
                <li key={b} className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="bt-hero-in bt-float mx-auto hidden w-[260px] [animation-delay:.15s,0s] lg:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/landing/${lang}-home.webp`} width={480} height={1040} alt={c.gallery[0]} className="h-auto w-full rounded-[2rem] border border-border shadow-2xl" />
          </div>
        </section>

        <section aria-labelledby="gallery" className="-mx-5 lg:mx-0">
          <h2 id="gallery" className="sr-only">
            {c.galleryTitle}
          </h2>
          <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-3 lg:justify-center lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {GALLERY.map((k, i) => (
              <li key={k} className="w-[58%] max-w-[240px] shrink-0 snap-center first:ml-0 sm:w-[30%] lg:w-[18%]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/landing/${lang}-${k}.webp`} width={480} height={1040} alt={c.gallery[i]} loading={i < 2 ? "eager" : "lazy"} decoding="async" className="h-auto w-full rounded-3xl border border-border shadow-md" />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="install" className="mt-8 rounded-3xl border border-border bg-surface p-5">
          <h2 id="install" className="text-xl font-bold tracking-tight">
            {c.install.title}
          </h2>
          <p className="mt-1 text-sm text-muted">{c.install.text}</p>
          <InstallButtons lang={lang} className="mt-4" />
        </section>

        <section aria-labelledby="features" className="mt-12">
          <h2 id="features" className="text-2xl font-bold tracking-tight">
            {c.featuresTitle}
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {c.features.map((f, i) => {
              const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length];
              return (
                <Reveal as="li" key={f.title} delay={(i % 3) * 80} className="flex gap-3 rounded-2xl border border-border bg-surface p-4 transition-shadow hover:shadow-md">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Icon size={20} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold leading-snug">{f.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{f.text}</p>
                  </div>
                </Reveal>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="steps" className="mt-12">
          <h2 id="steps" className="text-2xl font-bold tracking-tight">
            {c.stepsTitle}
          </h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-3">
            {c.steps.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 100} className="flex gap-3 rounded-2xl border border-border bg-surface p-4 sm:block">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">{i + 1}</span>
                <div className="sm:mt-2">
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted">{s.text}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </section>

        <section aria-labelledby="privacy" className="mt-12">
          <h2 id="privacy" className="text-2xl font-bold tracking-tight">
            {c.privacyTitle}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">{c.privacy}</p>
          <p className="mt-3 rounded-xl bg-warn/10 px-4 py-3 text-sm leading-relaxed text-warn">{c.disclaimer}</p>
        </section>
        <section aria-labelledby="plans" className="mt-12">
          <h2 id="plans" className="text-2xl font-bold tracking-tight">
            {c.plans.title}
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[c.plans.free, c.plans.premium].map((p, i) => (
              <Reveal key={p.name} delay={i * 100} className={`rounded-2xl border p-5 ${i === 1 ? "border-primary bg-primary-soft/40" : "border-border bg-surface"}`}>
                <h3 className="text-lg font-bold">{p.name}</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {p.items.map((it) => (
                    <li key={it} className="flex gap-2">
                      <Check size={16} aria-hidden className="mt-0.5 shrink-0 text-primary" />
                      {it}
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">{c.plans.note}</p>
        </section>

        <section aria-labelledby="article" className="mt-12">
          <h2 id="article" className="text-2xl font-bold tracking-tight">
            {c.article.title}
          </h2>
          <div
            tabIndex={0}
            role="region"
            aria-label={c.article.title}
            className="relative mt-4 h-[250px] overflow-y-auto rounded-2xl border border-border bg-surface p-4 text-sm leading-relaxed [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-primary"
          >
            {c.article.sections.map((x) => (
              <div key={x.h} className="mb-4 last:mb-0">
                <h3 className="font-semibold">{x.h}</h3>
                <p className="mt-1 text-muted">{x.p}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted" aria-hidden>
            {lang === "tr" ? "Okumak için kaydır ↓" : "Scroll to read ↓"}
          </p>
        </section>

        <section aria-labelledby="faq" className="mt-12">
          <h2 id="faq" className="text-2xl font-bold tracking-tight">
            {c.faqTitle}
          </h2>
          <div className="mt-5 divide-y divide-border rounded-2xl border border-border bg-surface">
            {c.faq.map((f) => (
              <details key={f.q} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown size={18} aria-hidden className="shrink-0 text-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-3xl bg-primary px-6 py-10 text-center text-white">
          <h2 className="text-balance text-2xl font-extrabold tracking-tight sm:text-3xl">{c.finalTitle}</h2>
          <p className="mt-2 text-sm opacity-90 sm:text-base">{c.finalText}</p>
          <Link href="/register" className="mt-5 inline-flex h-12 items-center justify-center rounded-xl bg-white px-7 font-semibold text-primary active:scale-[.98]">
            {c.cta}
          </Link>
        </section>
      </main>

      <footer className="mx-auto mt-12 max-w-5xl border-t border-border px-5 pt-6 text-sm text-muted">
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/privacy" className="underline">
            {c.privacyLink}
          </Link>
          <Link href="/terms" className="underline">
            {c.termsLink}
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

      {/* Mobilde ekranın altında sabit başlama çubuğu */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:hidden">
        <Link href="/register" className="flex h-12 items-center justify-center rounded-xl bg-primary font-semibold text-white active:scale-[.98]">
          {c.cta}
        </Link>
      </div>
    </div>
  );
}
