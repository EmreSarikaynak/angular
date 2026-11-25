# iOS: TestFlight ve App Store yayını

Önkoşul: ücretli Apple Developer hesabı (onaylı), Mac + Xcode, Firebase iOS uygulaması (`GoogleService-Info.plist` projede hazır).

## 1. developer.apple.com → Certificates, Identifiers & Profiles
1. **Identifiers → + → App IDs → App**: Bundle ID (Explicit) `tr.com.bkny.app`. Yetenekler: **Push Notifications**, **HealthKit**, **In-App Purchase** (genelde varsayılan açık).
2. **Keys → +**: **Apple Push Notifications service (APNs)** anahtarı oluştur, `.p8` dosyasını indir (bir kez indirilir; sakla). Key ID ve Team ID'yi not et.
3. Firebase Console → Project settings → Cloud Messaging → iOS uygulaması → **APNs Authentication Key**: `.p8`, Key ID, Team ID yükle.

## 2. App Store Connect (appstoreconnect.apple.com)
1. **Apps → + → New App**: Platform iOS, ad `BKNY`, birincil dil Türkçe, Bundle ID `tr.com.bkny.app`, SKU `bkny-ios-1`.
2. **Users and Access → Integrations → In-App Purchase**: anahtar oluştur (`.p8`, Key ID, Issuer ID). Bunları RevenueCat'e gireceksin.
3. **Monetization → Subscriptions**: abonelik grubu `BKNY Premium`; ürünler `bkny_premium_monthly` (1 ay) ve `bkny_premium_yearly` (1 yıl). Fiyat: Türkiye için aylık ₺99,99'a, yıllık ₺799,99'a en yakın fiyat basamağı. Her ürüne Türkçe/İngilizce görünen ad ve açıklama gir. İnceleme için paywall ekran görüntüsü ekle.
4. **App Information**: kategori Health & Fitness, gizlilik politikası `https://bkny.com.tr/privacy`, kullanım koşulları (EULA) `https://bkny.com.tr/terms`.
5. **App Privacy** ve **yaş derecelendirmesi** cevapları: `store/STORE.md`. Satın alımlar (Purchases) bölümünü de işaretle.
6. **Sürüm sayfası**: açıklama, anahtar kelimeler, tanıtım metni `store/listing.json` içinde hazır. Ekran görüntüleri: `store/dist` (6,9" ve 6,5"). Destek URL'si `https://bkny.com.tr`.
7. **İnceleme notları** ve demo hesabı: `store/listing.json` → `reviewNotes`, `store/STORE.md`.

## 3. RevenueCat
iOS uygulamasını ekle (Bundle ID `tr.com.bkny.app`), In-App Purchase anahtarını yükle, ürünleri içe aktar, `premium` entitlement'ına bağla ve `default` offering'e Monthly/Annual paketlerini ekle. iOS "public SDK key"ini (`appl_…`) Vercel'de `NEXT_PUBLIC_REVENUECAT_IOS_KEY` olarak ekle ve yeniden deploy et.

## 4. Xcode (Mac)
```bash
cd ~/bkn && git pull && npm install && npx cap sync ios && npx cap open ios
```
1. **App hedefi → Signing & Capabilities**: Team = Apple Developer ekibin, "Automatically manage signing" açık. Yetenekler: **Push Notifications**, **HealthKit**, **In-App Purchase**, **Background Modes → Remote notifications**.
2. Version `1.0`, Build `1`. Her yüklemede Build numarasını artır.
3. Hedef cihaz **Any iOS Device (arm64)** → **Product → Archive** → **Distribute App → App Store Connect → Upload**.
4. İşleme ~15 dakika sürer; sonra App Store Connect → **TestFlight**'ta build görünür. Dahili test grubu oluşturup kendini ekle, TestFlight uygulamasından kur.

## 5. TestFlight'ta denenecekler
- Giriş, fotoğraf/barkod (kamera izni), bildirim (gerçek cihaz), Apple Sağlık izni ve okuma.
- Premium: Users and Access → Sandbox → test hesabıyla satın alma; "Premium üyesin" ve Supabase `subscriptions` kaydı.
- Hesap silme (Profil › Hesabımı sil) çalışıyor olmalı (Apple 5.1.1).

## 6. İncelemeye gönder
Sürüm sayfasında build'i seç, **Aboneliklerin** sürümle birlikte incelemeye eklendiğini doğrula, "Add for Review" → "Submit".

## Apple'ın sık takıldığı noktalar
- **4.2 (web sarmalayıcı):** kamera, barkod, bildirim, HealthKit, sesle giriş gibi yerel özellikleri inceleme notunda belirt.
- **3.1.1 / 3.1.2:** abonelik yalnızca uygulama içi satın alma (StoreKit) ile satılır; metinde fiyat, süre, otomatik yenileme, iptal ve gizlilik/koşullar bağlantıları var (Premium ekranı + mağaza açıklaması).
- **5.1.3 (sağlık verisi):** HealthKit yalnızca okunur; reklam ya da üçüncü taraflarla paylaşılmaz (gizlilik metninde yazılı).
- **5.1.1(v):** uygulama içinden hesap silme var.

## Tek komutla arşivle ve yükle
Xcode'da tıklamak yerine proje kökünde:
```bash
git pull && npm install
./scripts/ios-release.sh        # ya da: npm run cap:ios:release
```
Betik `cap sync ios` çalıştırır, Release arşivi alır (`-allowProvisioningUpdates` ile imza/profil otomatik), App Store Connect'e yükler. Build numarası varsayılan olarak zaman damgasıdır (her yüklemede artar); elle vermek için `BUILD=7 ./scripts/ios-release.sh`. Önkoşul: Xcode → Settings → Accounts'ta Apple Developer hesabın ekli olmalı. Team ID varsayılanı `2FJ93AW33K`, değiştirmek için `TEAM_ID=... ./scripts/ios-release.sh`.

### "Your team has no devices from which to generate a provisioning profile" hatası
Apple, otomatik imzada arşiv için bir geliştirme profili ister; bunun için ekipte **en az bir kayıtlı iOS cihaz** gerekir. İki yol:
1. iPhone'u Mac'e USB ile bağla (iPhone'da Ayarlar → Gizlilik ve Güvenlik → Geliştirici Modu açık olmalı), "Bu bilgisayara güven"e dokun ve betiği yeniden çalıştır (betik `-allowProvisioningDeviceRegistration` ile cihazı otomatik kaydeder).
2. developer.apple.com → Certificates, Identifiers & Profiles → **Devices** → + → Platform iOS, ad ve iPhone'un **UDID**'si. UDID için: iPhone USB'de Mac'e bağlıyken Finder'da iPhone'u seç, adının altındaki model/depolama satırına tekrar tekrar tıklayınca UDID görünür; sağ tıkla "Kopyala". Sonra betiği çalıştır.
