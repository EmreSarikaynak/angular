"use client";
import Link from "next/link";
import { useApp } from "@/components/app-provider";

const CONTROLLER = process.env.NEXT_PUBLIC_DATA_CONTROLLER || "";
const CONTACT = process.env.NEXT_PUBLIC_PRIVACY_CONTACT || "";

export default function TermsPage() {
  const { t } = useApp();
  const sections: [string, string[]][] = [
    [
      t("Hizmet"),
      [
        t("BKNY; beslenme, su, takviye, uyku, hareket ve hedeflerini takip etmene yardımcı olan, yapay zekâ destekli bir uygulamadır."),
        t("Uygulama ücretsiz kullanılabilir. Ücretsiz planda günlük yapay zekâ kullanımı sınırlıdır; BKNY Premium aboneliği bu sınırı artırır."),
      ],
    ],
    [
      t("BKNY Premium aboneliği"),
      [
        t("Abonelik, mobil uygulamada Google Play ya da Apple App Store üzerinden satın alınır. Fiyat ve süre, satın alma ekranında mağaza tarafından gösterilir."),
        t("Abonelik, seçtiğin süre sonunda otomatik olarak yenilenir ve yenileme tutarı mağaza hesabından (Google Play ya da Apple Kimliği) tahsil edilir."),
        t("Aboneliği, yenileme tarihinden en az 24 saat önce mağaza hesap ayarlarından iptal edebilirsin. İptal, mevcut dönemin sonunda geçerli olur; dönem sonuna kadar Premium özellikler kullanılmaya devam eder."),
        t("Ücretsiz deneme ya da tanıtım fiyatı sunulursa, süre dolmadan iptal etmezsen abonelik ücretli olarak başlar."),
        t("Ödeme ve iade işlemleri, satın aldığın mağazanın politikalarına ve yürürlükteki mevzuata tabidir; iade talepleri doğrudan mağazaya iletilir."),
        t("Fiyatlar ve limitler zamanla değişebilir; değişiklik mevcut abonelik döneminin fiyatını etkilemez ve mağaza kurallarına göre bildirilir."),
      ],
    ],
    [
      t("Yapay zekâ tahminleri ve sağlık"),
      [
        t("Kalori ve besin değerleri yapay zekâ tahminidir ve hata içerebilir; her kaydı düzenleyebilirsin. Ürün notları, etiket bilgisine ve genel yönergelere dayanır, belirli bir ürün ya da markayı değerlendirmez."),
        t("BKNY bir tıbbi cihaz değildir ve tıbbi tavsiye vermez. Sağlık durumun, ilaç ya da takviye kullanımın, hamileliğin veya yeme bozukluğun varsa hekimine veya diyetisyenine danış."),
      ],
    ],
    [
      t("Hesap ve kullanım"),
      [
        t("Hesabının güvenliğinden sen sorumlusun. Uygulamayı yasalara aykırı biçimde, kötüye kullanarak ya da hizmeti aksatacak şekilde kullanmamayı kabul edersin."),
        t("Hesabını ve tüm verilerini istediğin zaman Profil bölümünden silebilirsin. Aktif bir aboneliğin varsa, hesabı silmek aboneliği iptal etmez; aboneliği mağaza ayarlarından ayrıca iptal etmelisin."),
        t("Hizmeti iyileştirmek için özellikleri değiştirebilir veya kaldırabiliriz; önemli değişiklikleri uygulama içinde duyururuz."),
      ],
    ],
    [t("Sorumluluk"), [t("Hizmet olduğu gibi sunulur. Yasaların izin verdiği ölçüde, uygulamanın kullanımından doğan dolaylı zararlardan sorumlu değiliz. Tüketici olarak yasal hakların saklıdır.")]],
    [t("İletişim"), [t("Sorular için veri sorumlusuna ulaşabilirsin; iletişim bilgileri gizlilik metninde yer alır. Uyuşmazlıklarda Türkiye Cumhuriyeti hukuku uygulanır.")]],
  ];
  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/" className="text-sm font-medium text-primary">
        ← BKNY
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">{t("Kullanım koşulları ve abonelik")}</h1>
      {(CONTROLLER || CONTACT) && (
        <p className="mt-2 text-sm text-muted">
          {CONTROLLER} {CONTACT && `· ${CONTACT}`}
        </p>
      )}
      <div className="mt-6 space-y-6">
        {sections.map(([title, items]) => (
          <section key={title}>
            <h2 className="font-semibold">{title}</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted">
              {items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-8 text-sm text-muted">
        <Link href="/privacy" className="underline">
          {t("Gizlilik ve KVKK aydınlatma metni")}
        </Link>
      </p>
    </main>
  );
}
