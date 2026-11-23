# Saat ve sağlık verisi entegrasyonu: mağaza ve kurulum notları

BKNY, saatin verisini doğrudan saatten değil, **telefonun sağlık deposundan** okur (yalnızca okuma):
iOS'ta Apple Sağlık (HealthKit; Apple Watch verileri dahil), Android'de Health Connect (Galaxy/Pixel Watch, Garmin, Fitbit vb.).
Yalnızca mağaza/native uygulamada çalışır; tarayıcıda ve ana ekran web uygulamasında kart bilgi notu gösterir.

## Okunan veriler
| Veri | iOS (HealthKit) | Android (Health Connect) | Yazıldığı yer |
|---|---|---|---|
| Adım, mesafe | steps, distance | READ_STEPS, READ_DISTANCE | `daily_logs.steps`, halka kaydı |
| Halkalar | aktif enerji, egzersiz süresi, ayakta saatleri | READ_ACTIVE_CALORIES_BURNED, egzersiz oturumlarından süre | `health_rings` (kaynak `device`) |
| Uyku | sleep | READ_SLEEP | `daily_logs.sleep_hours` |
| Antrenman | workouts | READ_EXERCISE | `activities` |
| Kilo | weight | READ_WEIGHT | `body_measurements` |

Çakışma kuralları (`src/lib/bkn/health-map.ts`): elle girilen ya da ekran görüntüsünden okunan halka ezilmez; boş olmayan uyku değeri ezilmez; adım yalnızca cihaz değeri daha büyükse güncellenir; elle girilmiş benzer antrenman (aynı tür, ±10 dk) çiftlenmez; antrenmanlar kararlı kimlikle yazıldığı için yeniden eşitleme çift kayıt oluşturmaz. Halka hedefleri cihazdan gelmez: son bilinen hedefler ya da 600 kcal / 30 dk / 12 saat kullanılır.

## iOS (Apple Developer hesabı onaylanınca)
1. App ID'de (`tr.com.bkny.app`) **HealthKit** yeteneğini açın (Xcode "Automatically manage signing" ile otomatik yapar).
2. `App.entitlements` içinde `com.apple.developer.healthkit` zaten ekli. **Ücretsiz Personal Team HealthKit'i desteklemez**; cihaza kurmak için ücretli hesap gerekir. Simülatörde Team **None** ile derleme çalışmalıdır; Sağlık uygulamasına örnek veri ekleyerek deneyebilirsiniz.
3. `Info.plist`: `NSHealthShareUsageDescription` ekli (yalnızca okuma; yazma izni istenmez).
4. App Store Connect: App Privacy'de "Health & Fitness" zaten işaretli. İnceleme notlarına şunu ekleyin: "Health data is read-only, used only to fill the user's daily log, never for advertising or shared with third parties."

## Android (Google Play)
1. `android/app/src/main/AndroidManifest.xml` yalnızca 6 **okuma** iznini tutar; eklentinin varsayılan olarak eklediği diğer tüm okuma/yazma izinleri `tools:node="remove"` ile çıkarılmıştır. Play Console'daki **Health Connect izin beyanı** formunda bu 6 izin için gerekçe yazın:
   - READ_STEPS, READ_DISTANCE: günlük adım ve mesafe özeti
   - READ_ACTIVE_CALORIES_BURNED: yakılan kalori halkası ve kalori dengesi
   - READ_EXERCISE: antrenman listesi ve egzersiz süresi
   - READ_SLEEP: uyku süresi kaydı
   - READ_WEIGHT: kilo ilerleme grafiği
2. Gizlilik politikası adresi `health_connect_privacy_policy_url` (`strings.xml`) → https://bkny.com.tr/privacy. Politikada cihaz verisi maddesi yer alır.
3. `minSdkVersion` 26'ya çıkarıldı (Health Connect gereği; Android 8.0+).
4. Android 13 ve altında kullanıcının **Health Connect** uygulamasını Play Store'dan kurması gerekir; kart bunu uyarı olarak gösterir.
5. Veri güvenliği formunda "Sağlık bilgileri" ve "Fitness bilgileri" zaten işaretli olmalıdır (`STORE.md`).

## Test
- Android emülatörü (API 34+, Google Play imajı): Health Connect içine örnek adım/uyku ekleyin, Profil → Saat ve sağlık verileri → Bağlan.
- Gerçek cihaz: saatle eşleştirilmiş telefonda aynı akış. iPhone'da veri gelmezse Ayarlar › Sağlık › Veri Erişimi › BKNY.
- Eklenti sürümü: `@capgo/capacitor-health` 8.x (Capacitor 8). Güncellemeden önce sürüm notlarına bakın.
