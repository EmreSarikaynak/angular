# BKNY — Bugün Kendin için Ne yaptın?

Yapay zekâ destekli beslenme, su, takviye, spor ve sağlık takip uygulaması. Mobil öncelikli, çevrimdışı çalışabilen bir PWA.

- **Frontend / backend:** Next.js 16 (App Router, TypeScript), Tailwind CSS 4
- **Veritabanı, kimlik doğrulama, depolama:** Supabase (PostgreSQL + RLS, Auth, Storage)
- **Yapay zekâ:** Google Gemini API (yalnızca sunucudan çağrılır)
- **Grafikler:** Recharts · **PDF:** jsPDF · **Barkod:** BarcodeDetector / ZXing + Open Food Facts

## Özellikler

| Alan | Kapsam |
| --- | --- |
| Profil ve hedefler | Kayıt, 3 adımlı başlangıç sihirbazı, Mifflin-St Jeor ile kalori / protein / karbonhidrat / yağ / su hedefi, elle düzenleme |
| Yemek ekleme | Fotoğraf (kamera/galeri), doğal dilde yazı, barkod, besin etiketi fotoğrafı, favoriler, elle giriş |
| Analiz | Tabaktaki her yiyecek ayrı kalem; gramaj, kalori, protein, karbonhidrat, yağ, şeker, lif, tuz; referans tablo desteği; "Tahmini" ve "Düşük güven" işaretleri; düşük güvende porsiyon sorusu; onaydan önce tüm değerler düzenlenebilir |
| Günlük | 6 öğün kategorisi, tarih/saat, geçmiş güne kayıt, düzenleme, silme, başka güne kopyalama |
| Su | Hızlı ekleme (100–1000 ml, özel), dairesel ilerleme, hatırlatmalar |
| İçecekler | Alkollü/alkolsüz türler, saf alkol (g), şeker, kalori; günlük ve haftalık özet; suya sayılmaz |
| Aktivite | 11 aktivite türü, MET + süre + mesafe + kilo ile net kalori, adım sayısı ve hedefi, çifte sayım önleme |
| Ölçümler | Kilo, bel, kalça, göğüs, yağ oranı, VKİ; grafikler; hedef ilerlemesi |
| Uyku ve durum | Uyku süresi/kalitesi, ruh hali, enerji, stres, not |
| İstatistikler | Günlük/haftalık/aylık/yıllık; kalori, makro dağılımı, su, kilo, aktivite, alkol, en sık yiyecekler, hedeflere uyum, kişisel ilişkiler; PDF ve CSV |
| Takviyeler | Kullanıcının girdiği ad, doz ve saatler; günlük kontrol listesi; saati gelince ve alınmadıysa motive edici tekrar bildirimleri (uygulama doz önermez) |
| Öneriler | Bugünkü protein açığı, son 3 günün eğilimi (fazla/eksik olan değer), buna uygun tarifler, alerji/tercih filtresi, Gemini ile kişisel tarif, tek dokunuşla günlüğe ekleme |
| Sağlık halkaları | Akıllı saat/telefon ekran görüntüsünden (ya da elle) hareket, egzersiz, ayakta, adım; üç halkalı grafik günlüğe ve ana sayfaya yazılır |
| Performans özeti | Haftalık, 3 haftalık, aylık, 3 aylık ve yıllık değerler tek tabloda; BKNY skoru; PDF ve PNG indirme |
| Bildirimler | Su, takviye, protein açığı, eğilim uyarısı, haftalık/aylık özet; tür bazında aç/kapat ve sıklık ayarı (Profil › Bildirimler) |
| BKNY skoru | "Bugün kendin için ne yaptın?" kartı: öğün, protein, su, hareket, takviye ve uyku üzerinden 0–100 |
| Seri ve rozetler | Kesintisiz kayıt serisi, su serisi ve 12 rozet; ana sayfada seri göstergesi, Performans sayfasında rozetler |
| Akşam kapanışı | Seçilen saatte "Bugün kendin için ne yaptın?" bildirimi ve günün kısa özeti |
| Öğün planı | Hedef, alerji ve tercihlere göre Gemini ile 7 günlük plan; öğünü günlüğe ekleme; işaretlenebilir, paylaşılabilir alışveriş listesi |
| Takviye stoku | Kutudaki adet ve doz başına adet; alındıkça düşer, yaklaşık 5 günlük kalınca uyarı ve bildirim |
| Kafein | İçecek türüne göre mg hesabı, günlük 400 mg sınırı, 16:00 sonrası uyarısı |
| Aralıklı oruç | Hedef süre (12–20 saat), geçmiş saatten başlatma, sayaç, geçmiş ve ortalama |
| Diyetisyen paylaşımı | Açık rızayla oluşturulan süreli, salt okunur rapor bağlantısı; bölüm seçimi; görüntülenme sayısı; tek dokunuşla iptal |
| Sesle ekleme | Tarayıcının konuşma tanımasıyla söylenen yemek metne çevrilir ve analiz edilir (Chrome, Edge, Safari) |
| Tariflerim | Ev yemeğinin malzemeleri bir kez girilir; toplam ve porsiyon başı değer hesaplanır, porsiyon sayısıyla günlüğe eklenir |
| Öğünü tekrarla | Günlükte boş öğünde, önceki günlerdeki son kaydı tek dokunuşla ekleme |
| Haftalık mektup | Son 7 günün kayıtlarından Gemini ile kişisel kısa değerlendirme; haftada bir, saklanır |
| Meydan okumalar | Katılım koduyla arkadaş grubu; kayıt, su, protein ya da adım hedefi; yalnızca takma ad ve başarılan gün sayısı paylaşılır |
| Döngü takibi | Adet dönemi kaydı, döngü günü ve evresi, sonraki tahmin; ölçüm sayfasında su tutulumu notu |
| Vitamin ve mineraller | Demir, kalsiyum, magnezyum, potasyum, C, B12, D; analizle birlikte tahmin edilir, İstatistikler'de referans değere göre gösterilir |
| Ramazan modu | Sahur/İftar öğün adları, iftar–sahur geri sayımı, hatırlatmaların yalnızca yeme penceresinde gönderilmesi |
| Dışarıda yemek | Menü fotoğrafından yemekler, tahmini değerler, kalan hedefe göre öneri ve alerjen uyarısı |
| Diyetisyen paneli | Diyetisyen davet koduyla danışan toplar; danışan açık rızayla bağlanır ve paylaşılacak bölümleri seçer. Panelde danışan listesi, son 7 gün özeti, ilgi bekleyenler, ayrıntılı rapor ve notlar (danışana görünür ya da özel) |
| Asistan | Kullanıcının kendi kayıtlarına dayalı sohbet; teşhis/tedavi önermez |
| Yönetim paneli | Kullanıcılar, Gemini ayarları ve bağlantı testi, kullanım/maliyet, limitler, hata kayıtları, duyuru |
| Gizlilik | RLS, özel fotoğraf deposu, veri indirme, fotoğraf ve hesap silme |
| PWA | Ana ekrana eklenebilir, çevrimdışı kayıt kuyruğu ve otomatik eşitleme, Web Push |
| Arayüz | Açık/koyu tema, Türkçe/İngilizce |

## Kurulum

### 1. Supabase projesi

1. [supabase.com](https://supabase.com) üzerinde bir proje oluşturun (KVKK/GDPR için AB bölgesi önerilir).
2. Şemayı uygulayın — iki yoldan biri:
   - **CLI:** `npx supabase link --project-ref <ref>` ardından `npx supabase db push`
   - **Elle:** `supabase/migrations/` klasöründeki dosyaları **tarih sırasıyla** SQL Editor'de çalıştırın (`20261122000000_init.sql`, `20261123000000_bkn_features.sql`, `20261124000000_bkn_extras.sql`, `20261125000000_bkn_more.sql`, `20261126000000_dietitian.sql`).
   Migration; tabloları, RLS politikalarını, yeni kullanıcı tetikleyicisini ve özel `meal-photos` depolama kovasını oluşturur.
3. **Authentication › URL Configuration:** Site URL olarak yayın adresinizi girin; Redirect URLs listesine `https://alan-adiniz/reset` ekleyin.
4. **Authentication › Providers › Email:** en az şifre uzunluğunu 8 yapın. E-posta doğrulamasını açık tutmanız önerilir (yönetici ataması doğrulanmış e-posta ister).

### 2. Ortam değişkenleri

`.env.example` dosyasını `.env.local` olarak kopyalayıp doldurun.

| Değişken | Zorunlu | Açıklama |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✔ | Supabase › Project Settings › API |
| `SUPABASE_SERVICE_ROLE_KEY` | ✔ | **Gizli.** Yalnızca sunucuda kullanılır |
| `GEMINI_API_KEY` | YZ için | **Gizli.** [Google AI Studio](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | – | Varsayılan `gemini-3.8-flash`; yönetim panelinden değiştirilebilir |
| `ADMIN_EMAILS` | – | Virgülle ayrılmış yönetici e-postaları |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` | Bildirim için | `npx web-push generate-vapid-keys` |
| `NEXT_PUBLIC_DATA_CONTROLLER`, `NEXT_PUBLIC_PRIVACY_CONTACT` | – | Gizlilik sayfasında gösterilen veri sorumlusu bilgisi |

Gemini anahtarı hiçbir zaman tarayıcıya gönderilmez; tüm YZ istekleri `/api/ai/*` üzerinden geçer.

### 3. Çalıştırma

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

Service worker (çevrimdışı kabuk, bildirimler) yalnızca üretim derlemesinde kaydedilir.

### 4. İlk yönetici

`ADMIN_EMAILS` içine e-postanızı yazıp o adresle kayıt olun **veya** SQL ile atayın:

```sql
insert into public.admins (user_id) select id from auth.users where email = 'siz@ornek.com';
```

Yönetim paneli: `/admin`. Panel kişisel sağlık kayıtlarını göstermez.

## Yayınlama (Vercel)

1. Depoyu Vercel'e aktarın (uygulama deponun kökündedir; Root Directory ayarına gerek yoktur). Vercel varsayılan dalı (`master`) dağıtır: uygulamanın bulunduğu dalı ya `master`'a birleştirin ya da Settings › Git › Production Branch olarak seçin.
2. Yukarıdaki ortam değişkenlerini Production ortamına ekleyin.
3. Dağıtın, ardından Supabase'de Site URL'yi yayın adresiyle güncelleyin.
4. **Hatırlatmalar (su, takviye, protein, eğilim, akşam kapanışı, özet):** `/api/cron/reminders` ucu düzenli çağrılmalıdır. Vercel Hobby planı günde birden sık cron'a izin vermediği için depoda `vercel.json` cron tanımı **yoktur**; ücretsiz bir dış zamanlayıcı kullanın:
   - Vercel'de `CRON_SECRET` (uzun rastgele bir metin) ve bildirim anahtarlarını ekleyin: `npx web-push generate-vapid-keys` ile üretilen `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` ve `VAPID_SUBJECT` (`mailto:siz@ornek.com`). Ardından yeniden dağıtın.
   - [cron-job.org](https://cron-job.org) (ücretsiz) üzerinde **15 dakikada bir** (`*/15 * * * *`) çalışan bir iş oluşturun. Bildirim saatleri 15 dakikalık adımlarla (19:00, 19:15 …) ayarlandığı için bu sıklık yeterlidir. URL: `https://<adresiniz>/api/cron/reminders`, yöntem GET, başlık: `Authorization: Bearer <CRON_SECRET>`.
   - Alternatif: Supabase `pg_cron` + `pg_net`, GitHub Actions `schedule` (zamanlama gecikebilir) ya da Vercel Pro planında `vercel.json` içine `"crons": [{ "path": "/api/cron/reminders", "schedule": "*/10 * * * *" }]` eklemek.
   - Takviye saatlerinin dakikliği çağrı sıklığına bağlıdır (15 dakikalık adımlarla ayarlanan saatler için 15 dakika yeterlidir). Push yapılandırılmazsa su ve takviye hatırlatmaları yalnızca uygulama açıkken yerel bildirim olarak gösterilir; protein, eğilim, akşam ve özet bildirimleri gönderilmez.

Başka bir Node.js barındırma ortamında `npm run build && npm start` yeterlidir; cron ucunu kendi zamanlayıcınızla çağırın.

## Mobil uygulama (iOS ve Android)

Uygulama, [Capacitor](https://capacitorjs.com) ile iOS ve Android için yerel bir kabuğa sarılmıştır (`ios/` ve `android/` klasörleri, yapılandırma: `capacitor.config.ts`, uygulama kimliği: `tr.com.bkny.app`). Kabuk, canlı web sürümünü yükler; web sürümü her güncellendiğinde mağaza güncellemesi beklemeden herkes yeni sürümü görür. Bağlantı yoksa `capacitor/www/index.html` yedek sayfası gösterilir (çevrimdışı kayıt kuyruğu, web sürümü bir kez yüklendiyse çalışmaya devam eder).

### Mac'te kurulum
1. Node.js 22+, [Xcode](https://apps.apple.com/app/xcode/id497799835) (iOS Simulator çalışma zamanıyla) ve [Android Studio](https://developer.android.com/studio) (SDK Platform 36, Android Emulator, bir sanal cihaz: Device Manager › Create Device › Pixel, API 35/36).
2. `git clone` sonrası `npm install`. iOS projesi Swift Package Manager kullanır; CocoaPods gerekmez.
3. `npm run cap:doctor` ile ortamı kontrol edin.

### Simülatörde çalıştırma
```bash
npm run cap:ios        # Xcode açılır → üstten bir iPhone simülatörü seçin → ▶ Run
npm run cap:android    # Android Studio açılır → bir emülatör başlatın → ▶ Run
# ya da komut satırından: npm run cap:run:ios  /  npm run cap:run:android
```
Varsayılan olarak `https://bkn-black.vercel.app` yüklenir. Kendi alan adınız hazır olunca:
```bash
CAP_SERVER_URL=https://bkny.com.tr npm run cap:sync
```
Yerel geliştirme sunucusunu (`npm run dev`) simülatörde denemek için: iOS `CAP_SERVER_URL=http://localhost:3000 npx cap sync ios`, Android emülatörü `CAP_SERVER_URL=http://10.0.2.2:3000 npx cap sync android` (10.0.2.2, bilgisayarınızı gösterir). Yerel Supabase için Docker açık olmalıdır.

Simülatörde kontrol edin: kamera/galeri izni ve fotoğraf analizi, barkod okuma, kayıt/giriş, e-posta bağlantılarının uygulamayı değil tarayıcıyı açması, üst ve alt güvenli alanlar (çentik, durum çubuğu, ana ekran çizgisi), klavye açılınca formların kayması, koyu tema, çevrimdışı yedek sayfa.

### Simge ve açılış ekranı
`node scripts/make-app-icons.cjs` kaynak görselleri `resources/` içine üretir, `npm run cap:assets` tüm boyutları iOS ve Android projelerine yazar.

### Mağaza sürümü
- **Android:** Android Studio › Build › Generate Signed App Bundle (`.aab`). Yükleme anahtarını (keystore) oluşturup güvenli yerde saklayın; kaybederseniz güncelleme yükleyemezsiniz. Her yüklemede `android/app/build.gradle` içindeki `versionCode`'u artırın. Play Console'da önce **Dahili/Kapalı test**, sonra üretim.
- **iOS:** Xcode › App target › Signing & Capabilities: Team'inizi seçin (Automatic signing). Product › Archive › Distribute App › App Store Connect. Önce **TestFlight**. Her yüklemede Build numarasını artırın.
- **Mağaza sayfası için:** gizlilik politikası adresi (`https://<alanadı>/privacy`), ekran görüntüleri, açıklama, yaş derecelendirmesi, Play'de "Veri güvenliği" ve "Sağlık uygulamaları" beyanı, Apple'da "App Privacy" ve inceleme için bir test hesabı. Hesap silme uygulama içinde mevcuttur (Profil › Hesabımı sil).
- Apple, yalnızca siteyi saran uygulamaları reddedebilir (Guideline 4.2); kamera, barkod, çevrimdışı kayıt ve yerel bildirim bu riski azaltır.

### Mobil bildirimler (Firebase Cloud Messaging)
Tek bir hat hem Android'e hem iOS'a gider: iOS'ta bildirimi Apple'ın servisi (APNs) taşır, FCM onun önünde durur. Sunucu tarafında ek paket yoktur; `src/lib/bkn/fcm.ts` Google'ın REST arayüzünü kullanır ve mevcut hatırlatma motoru (`/api/cron/reminders`) web ve mobil cihazlara aynı anda gönderir. Cihaz belirteçleri `device_tokens` tablosunda tutulur; çıkışta ve bildirim kapatılınca silinir, geçersiz belirteçler gönderimde otomatik temizlenir.

1. **Firebase projesi:** [console.firebase.google.com](https://console.firebase.google.com) › yeni proje (Analytics gerekmez).
2. **Android uygulaması:** Project settings › Add app › Android, paket adı `tr.com.bkny.app`. İndirilen `google-services.json` dosyasını `android/app/` içine koyup commit'leyin (anahtar değil, istemci yapılandırmasıdır).
3. **iOS uygulaması:** Add app › iOS, paket kimliği `tr.com.bkny.app`. İndirilen `GoogleService-Info.plist` dosyasını Xcode'da `App` klasörüne sürükleyin (Copy items if needed, "App" target'ı işaretli) ve commit'leyin.
4. **APNs anahtarı (iOS):** [developer.apple.com](https://developer.apple.com/account) › Certificates, Identifiers & Profiles › Keys › **+** › "Apple Push Notifications service (APNs)" › `.p8` dosyasını indirin (yalnızca bir kez indirilir; Key ID ve Team ID'yi not edin). Firebase › Project settings › Cloud Messaging › Apple app configuration › APNs Authentication Key'e yükleyin.
5. **Sunucu anahtarı:** Firebase › Project settings › Service accounts › Generate new private key. İnen JSON'un **tamamını** Vercel'de `FIREBASE_SERVICE_ACCOUNT` değişkenine yapıştırın (gizlidir, depoya koymayın) ve yeniden dağıtın.
6. **Zamanlayıcı:** yukarıdaki "Hatırlatmalar" adımındaki `CRON_SECRET` ve cron-job.org çağrısını kurun.
7. **Xcode:** App target › Signing & Capabilities'te *Push Notifications* ve *Background Modes › Remote notifications* görünmelidir (projede hazırdır; yoksa **+ Capability** ile ekleyin). Team'inizi seçin.
8. `npm run cap:sync`, sonra uygulamayı yeniden derleyin.

Deneme: **Android emülatöründe** (Google Play görüntülü) ve **gerçek iPhone'da** Profil › Bildirimler › "Bu cihazda bildirimleri aç"; sonra `curl -H "Authorization: Bearer $CRON_SECRET" https://<adres>/api/cron/reminders`. iOS simülatörü FCM belirteci alamayabilir; iOS bildirimlerini gerçek cihazda deneyin. Su hatırlatması için profilde su hatırlatmasının açık ve saat aralığının içinde olması gerekir.

### Bilinen sınırlar (ilk sürüm)
- **Bildirimler:** mobil uygulama bildirimleri Firebase Cloud Messaging (FCM) ile çalışır; kurulum aşağıdaki "Mobil bildirimler" bölümündedir. Kurulmadan bildirim ayarı çalışmaz (uygulama içinde "güncel sürüm gerekir" ya da izin sonrası sessizce kayıt olur, gönderim yapılmaz).
- **Sesle ekleme:** tarayıcı konuşma tanıması uygulama içindeki web görünümlerinde yoktur; düğme gizlenir ve klavyedeki mikrofon önerilir.
- Bu kabuk bu depoda otomatik olarak simülatörde sınanmadı; güvenli alanlar ve klavye davranışı ilk çalıştırmada gözden geçirilmelidir.

## Android: Google Play iç test sürümü

Önkoşullar: Android Studio (SDK ile), JDK (Android Studio ile gelir), Google Play Console hesabı.

1. **Yükleme anahtarı (upload key) oluşturun** (bir kez; dosyayı ve şifreyi güvenle saklayın, kaybederseniz Play desteğiyle sıfırlamanız gerekir):
   ```bash
   cd android
   keytool -genkeypair -v -keystore upload-keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```
2. `android/keystore.properties` dosyasını oluşturun (git'e **girmez**):
   ```
   storeFile=upload-keystore.jks
   storePassword=<şifre>
   keyAlias=upload
   keyPassword=<şifre>
   ```
3. Paketi üretin (proje kökünde): `npm run cap:android:bundle`. Çıktı: `android/app/build/outputs/bundle/release/app-release.aab`.
   Uygulama varsayılan olarak `https://bkny.com.tr` adresini yükler (`CAP_SERVER_URL` ile değiştirilebilir).
4. Play Console → uygulamayı oluşturun (ad BKNY, Türkçe, uygulama, ücretsiz) → **Test et → Dahili test → Yeni sürüm oluştur** → AAB'yi yükleyin → **Play Uygulama İmzalama**'ya katılın → sürümü yayınlayın.
5. **Test kullanıcıları** listesi oluşturup e-postaları ekleyin; Play'in verdiği **katılım bağlantısını** test kullanıcılarına gönderin, bağlantıdan sonra Play Store'dan indirirler.
6. Sürümü güncellerken `android/app/build.gradle` içinde `versionCode` değerini artırın (şu an 2: 1 numaralı paket abonelik eklentisi olmadan yüklenmişti) (her yüklemede benzersiz ve artan olmalı).

Notlar: Firebase (FCM) için `android/app/google-services.json` depoda hazırdır; Play'in uygulamayı yeniden imzalaması FCM bildirimlerini etkilemez. Uygulama içerik olarak canlı siteyi gösterdiği için Google Play incelemesinde "yalnızca web sitesi sarmalayıcısı" olarak değerlendirilmemesi için yerel özellikler (kamera, bildirimler) ve açıklayıcı mağaza metni önemlidir.

## Mimari

```
src/
  app/
    (auth)/            giriş, kayıt, şifre sıfırlama
    (app)/             oturum gerektiren ekranlar (ana sayfa, günlük, ekle, su, içecek, aktivite,
                       ölçüm, uyku, istatistik, asistan, profil, yönetim)
    api/
      ai/analyze       fotoğraf / yazı / etiket analizi (Gemini, yapılandırılmış JSON)
      ai/assistant     kişisel asistan
      barcode/[code]   Open Food Facts araması
      account/delete   fotoğrafları veya hesabı kalıcı silme
      admin/[action]   yönetim API'si
      ai/rings         sağlık halkası ekran görüntüsü okuma
      ai/recipes       kişisel tarif önerileri
      ai/meal-plan     haftalık öğün planı ve alışveriş listesi
      ai/weekly-letter haftalık mektup
      ai/menu          restoran menüsü rehberi
      dietitian        diyetisyen paneli (etkinleştir, bağlan, bölümler, notlar, bitir); dietitian/client/[id] danışan raporu
      challenges       meydan okumalar (oluştur, kodla katıl, ayrıl; ilerleme sunucuda hesaplanır)
      share            paylaşım bağlantısı oluşturma; share/[token] salt okunur rapor verisi (oturumsuz)
      cron/reminders   tüm hatırlatmalar (Web Push)
      config           kota, duyuru, YZ durumu
  lib/
    nutrition/         hedef hesabı, MET tablosu, içecek/alkol hesabı, referans besin tablosu
    bkn/               tarif kitaplığı, eğilim analizi, BKNY skoru, performans özeti, bildirim mesajları ve motoru
    ai/                Gemini istemcisi, istemler, şemalar, son işleme, limit/önbellek/kullanım kaydı
    data/              çevrimdışı öncelikli veri katmanı (kuyruk + önbellek) ve kancalar
    i18n/              Türkçe kaynak metinler, İngilizce sözlük
supabase/migrations/   veritabanı şeması
public/sw.js           service worker
```

- **İstemci öncelikli:** Ekranlar Supabase'e doğrudan (RLS korumalı) bağlanır; YZ ve yönetici işlemleri `Authorization: Bearer <jwt>` bekleyen HTTP API'leridir. Aynı sözleşme native (React Native / Capacitor) bir istemciden değişmeden kullanılabilir.
- **Çevrimdışı:** Yazma işlemleri ağ yoksa cihazdaki kuyruğa alınır; kimlikler istemcide üretildiği için yeniden gönderim güvenlidir. Bağlantı gelince sırayla gönderilir.
- **Besin doğruluğu:** Gemini her kalemi tanır ve gramajı tahmin eder. Kalem referans tablosundaki (USDA FoodData Central ve TürKomp tipik değerlerinden derlenmiş 154 yiyecek) bir kayıtla eşleşirse besin değerleri modelin tahmininden değil tablodan hesaplanır. Eşleşmeyenler "Yapay zekâ tahmini" olarak işaretlenir; kalori makrolarla %25'ten fazla çelişirse düzeltilir ve güven düşürülür.
- **Bildirimler:** Her bildirim `notification_log` tablosundaki benzersiz anahtarla yalnızca bir kez gönderilir. Alınmayan takviye, kullanıcının seçtiği aralıkla en fazla 4 kez ve saatinden sonraki 3 saat içinde hatırlatılır. Eğilim uyarısı aynı konuda en erken 3 günde bir gider; hiç kayıt girmemiş kullanıcıya "eksik" uyarısı gönderilmez.
- **Sağlık halkaları:** Halka kaydı olan günde yakılan kalori için cihazın değeri kullanılır; aktivite/adım tahminiyle toplanmaz.
- **Çifte sayım:** Aktivitelerde yalnızca dinlenme harcamasının üzerindeki net enerji `(MET − 1) × kg × saat` hesaplanır; yürüyüş/koşu kayıtlarının adımları adım sayısından düşülür; yakılan kalori varsayılan olarak günlük bütçeye eklenmez (Profil › Hedefler).
- **Limitler ve önbellek:** Kullanıcı başına günlük ve dakikalık limit `ai_usage` tablosundan sayılır (sunucusuz ortamda da tutarlı). Aynı istek `ai_cache` tablosundan döner ve kotadan düşmez.

## Güvenlik ve gizlilik

- Tüm kullanıcı tablolarında RLS: `auth.uid() = user_id`. Yönetim tablolarında (`admins`, `app_settings`, `user_limits`, `ai_usage`, `ai_cache`, `error_logs`) hiç politika yoktur; yalnızca sunucudaki service role erişir.
- Fotoğraflar özel kovada `<kullanıcı_id>/…` yolunda tutulur; tarayıcıda küçültülür (EXIF/konum atılır) ve kullanıcı saklamayı kapatabilir.
- Asistana yalnızca ad, yaş, hedefler ve günlük özetler gönderilir; soyad, e-posta, doğum tarihi, fotoğraflar ve notlar gönderilmez.
- Profil › Verilerim: JSON olarak indirme, fotoğrafları silme, hesabı kalıcı silme (`ON DELETE CASCADE`).
- Paylaşım bağlantısındaki 256 bitlik belirtecin yalnızca SHA-256 özeti saklanır; bağlantı bir kez gösterilir, süresi dolunca ya da iptal edilince 404 döner. Soyad, e-posta, doğum tarihi, fotoğraflar, notlar ve sohbetler hiçbir zaman paylaşılmaz; öğün ayrıntıları, vücut ölçümleri ve uyku/ruh hali yalnızca kullanıcı seçerse eklenir.
- Diyetisyen tablolarına tarayıcıdan erişim yoktur. Diyetisyen yalnızca etkin bağlantısı olan danışanın, danışanın izin verdiği bölümlerini görür; kapsamı yalnızca danışan değiştirebilir. Danışan paylaşımı bitirdiğinde erişim kesilir ve diyetisyenin o danışan hakkındaki notları silinir. BKNY diyetisyenin unvanını doğrulamaz.
- Meydan okuma tablolarına tarayıcıdan erişim yoktur; üyeler birbirinin yalnızca takma adını ve başardığı gün sayısını görür, ilerleme her üyenin kendi kayıtlarından sunucuda hesaplanır.
- Döngü kayıtları yapay zekâya, paylaşım raporuna ve meydan okumalara gönderilmez. Sesle girişte ses tarayıcının kendi tanıma servisine gider; uygulama sunucusuna yalnızca metin ulaşır.
- `/privacy` sayfası bir KVKK/GDPR aydınlatma metni **taslağıdır**; yayına almadan önce veri sorumlusu bilgilerinizi ekleyip hukuki incelemeden geçirin. Gemini API'nin veri işleme koşulları (ücretli katman, bölge) ve Supabase ile veri işleme sözleşmesi sizin sorumluluğunuzdadır.

## Testler

```bash
npm test                 # birim testleri (hesaplamalar, analiz doğrulama, istatistik, çeviri kapsamı)
npm run typecheck && npm run lint
```

Bütünleşme ve uçtan uca testler yerel Supabase (Docker) ve sahte bir Gemini sunucusu kullanır:

```bash
npx supabase start && npx supabase db reset
# .env.local: yerel Supabase anahtarları, GEMINI_API_KEY=test-key-local-mock,
#             GEMINI_API_BASE_URL=http://127.0.0.1:8787, ADMIN_EMAILS=admin@example.com, CRON_SECRET=…
npm run mock:gemini &
# Bildirim testi için: kendinden imzalı sertifikayla sahte push sunucusu
#   node tests/integration/mock-push.mjs key.pem cert.pem &   ve uygulamayı NODE_EXTRA_CA_CERTS=cert.pem ile başlatın
npm run build && npm start &
npm run test:integration   # RLS, depolama, API yetkileri, limitler, önbellek, hesap silme
npm run test:e2e           # tarayıcıda mobil + masaüstü akış, çevrimdışı kuyruk, service worker
```

`scripts/mock-gemini.mjs` yalnızca test içindir; uygulama içinde sahte veri üreten bir kod yolu yoktur.

## Bilinen sınırlar

- Kalori ve besin değerleri tahmindir; referans tablo ortalama tarifleri yansıtır.
- iOS'ta Web Push yalnızca uygulama ana ekrana eklendiğinde (iOS 16.4+) çalışır.
- Çevrimdışıyken YZ analizi, barkod araması ve profil değişikliği yapılamaz; elle kayıt, favoriler, su, içecek, aktivite, ölçüm ve uyku kayıtları kuyruğa alınır.
