"use client";
import Link from "next/link";
import { useApp } from "@/components/app-provider";

const CONTROLLER = process.env.NEXT_PUBLIC_DATA_CONTROLLER || "";
const CONTACT = process.env.NEXT_PUBLIC_PRIVACY_CONTACT || "";

export default function PrivacyPage() {
  const { t } = useApp();
  const sections: [string, string[]][] = [
    [
      t("Hangi verileri işliyoruz?"),
      [
        t("Hesap bilgileri: e-posta adresi, ad ve soyad."),
        t("Profil bilgileri: doğum tarihi, cinsiyet, boy, kilo, hedefler, alerjiler ve beslenme tercihleri."),
        t("Sağlık ve yaşam kayıtları: öğünler, içecekler, su, aktiviteler, adım, vücut ölçümleri, uyku, ruh hali ve notlar."),
        t("Yemek fotoğrafları (saklamayı açık bıraktıysanız)."),
      ],
    ],
    [
      t("Verileri neden işliyoruz?"),
      [t("Yalnızca uygulamanın işlevlerini sunmak için: hedef hesaplama, kayıt tutma, raporlama ve kişisel asistan yanıtları."), t("Sağlık verileri özel nitelikli kişisel veridir ve yalnızca açık rızanızla işlenir. Rızanızı hesabınızı silerek geri alabilirsiniz.")],
    ],
    [
      t("Yapay zekâ ile paylaşım"),
      [
        t("Fotoğraf ve metin analizinde yalnızca gönderdiğiniz fotoğraf ya da metin Google Gemini API'sine iletilir; kimlik bilgileriniz iletilmez."),
        t("Asistan sorularında ad, yaş, hedefler ve günlük özetler gibi yanıt için gerekli en az veri iletilir. Soyad, e-posta, doğum tarihi, fotoğraflar ve günlük notlarınız iletilmez."),
        t("Yapay zekâ anahtarı yalnızca sunucuda tutulur; tarayıcıya gönderilmez."),
      ],
    ],
    [
      t("Saklama ve güvenlik"),
      [
        t("Veriler Supabase (PostgreSQL) üzerinde saklanır. Satır düzeyinde güvenlik kuralları nedeniyle her kullanıcı yalnızca kendi kayıtlarına erişebilir."),
        t("Fotoğraflar herkese kapalı bir depolama alanında, yalnızca size ait klasörde tutulur."),
        t("Yöneticiler kişisel sağlık kayıtlarınızı yönetim panelinden göremez; yalnızca hesap ve kullanım sayaçları görüntülenir."),
        t("Çevrimdışı kullanım için son görüntülenen veriler cihazınızda saklanır ve çıkış yaptığınızda silinir."),
        t("Diyetisyen/koç paylaşımı yalnızca sizin oluşturduğunuz süreli bağlantıyla ve seçtiğiniz bölümlerle yapılır; bağlantıyı dilediğiniz an iptal edebilirsiniz."),
      ],
    ],
    [
      t("Haklarınız (KVKK md. 11 ve GDPR)"),
      [
        t("Verilerinize erişme ve bir kopyasını alma: Profil › Verilerimi indir."),
        t("Düzeltme: tüm kayıtlarınızı ve profilinizi uygulama içinden düzenleyebilirsiniz."),
        t("Silme: Profil › Fotoğraflarımı sil veya Hesabımı sil ile verileriniz kalıcı olarak silinir."),
        t("İtiraz ve şikâyet: veri sorumlusuna başvurabilir, Kişisel Verileri Koruma Kurulu'na şikâyette bulunabilirsiniz."),
      ],
    ],
    [t("Tıbbi sorumluluk reddi"), [t("Bu uygulama bilgilendirme amaçlıdır; tıbbi teşhis, tedavi veya profesyonel diyetisyen tavsiyesi yerine geçmez. Kalori ve besin değerleri tahminidir.")]],
  ];
  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/" className="text-sm font-medium text-primary">
        ← BKN
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">{t("Gizlilik ve KVKK aydınlatma metni")}</h1>
      {(CONTROLLER || CONTACT) && (
        <p className="mt-2 text-sm text-muted">
          {t("Veri sorumlusu")}: {CONTROLLER} {CONTACT && `· ${CONTACT}`}
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
    </main>
  );
}
