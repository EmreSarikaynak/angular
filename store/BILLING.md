# BKNY Premium abonelik: kurulum rehberi

Mimari: mobil uygulamada **RevenueCat** (Google Play Faturalandırma + Apple StoreKit) → satın alma → RevenueCat **webhook**'u `POST /api/billing/webhook` → `subscriptions` tablosu → sunucu, kullanıcının günlük yapay zekâ limitini artırır.
Uygulama, RevenueCat'e kullanıcı kimliği olarak Supabase `user.id` değerini verir; webhook bu kimlikle aboneliği eşleştirir.

## 1. Veritabanı
Supabase SQL Editor'da `supabase/migrations/20261208000000_subscriptions.sql` dosyasını çalıştır.

## 2. RevenueCat
1. app.revenuecat.com → proje oluştur → **Apps**: Android (paket `tr.com.bkny.app`) ve iOS (bundle `tr.com.bkny.app`) ekle.
2. **Android için servis hesabı:** Google Cloud'da servis hesabı + JSON anahtarı oluştur, Play Console → Kullanıcılar ve izinler'e bu hesabı ekle (finansal veri ve sipariş yönetimi izinleri), anahtarı RevenueCat'e yükle. (RevenueCat adım adım gösterir.)
3. **Ürünler (Products):** `bkny_premium_monthly` ve `bkny_premium_yearly` kimlikleriyle Play Console / App Store Connect'te abonelikleri oluştur, sonra RevenueCat'te içe aktar.
4. **Entitlement:** adı tam olarak `premium`; iki ürünü ona bağla.
5. **Offering:** `default` (current); içine Monthly ve Annual paketlerini ekle.
6. **API anahtarları:** Android ve iOS "public SDK key"lerini al.
7. **Webhook:** Project settings → Integrations → Webhooks → URL `https://bkny.com.tr/api/billing/webhook`, Authorization header: `Bearer <uzun-rastgele-gizli-değer>`.

## 3. Vercel ortam değişkenleri
- `NEXT_PUBLIC_REVENUECAT_ANDROID_KEY` = Android public SDK key (goog_…)
- `NEXT_PUBLIC_REVENUECAT_IOS_KEY` = iOS public SDK key (appl_…)
- `REVENUECAT_WEBHOOK_SECRET` = 7. adımdaki gizli değer
Ekledikten sonra yeniden deploy et (NEXT_PUBLIC_ değişkenleri derlemeye gömülür).

## 4. Play Console
- Abonelik ürünleri, uygulamanın en az bir test kanalına AAB yüklenmesinden sonra oluşturulabilir. Sıra: AAB yükle → Para kazanma → Ürünler → Abonelikler → `bkny_premium_monthly` / `bkny_premium_yearly` (temel plan: otomatik yenilenen, aylık/yıllık, fiyat TRY).
- İsteğe bağlı: ücretsiz deneme için teklif ekle (örn. 7 gün). Uygulama mağazanın verdiği teklifi gösterir.
- Test: Ayarlar → Lisans testi'ne test hesaplarını ekle; test satın almaları ücretlendirilmez.

## 5. App Store Connect / Xcode
- Xcode'da App hedefi → Signing & Capabilities → **In-App Purchase** ekle.
- App Store Connect → Abonelikler → abonelik grubu "BKNY Premium" + aylık/yıllık ürünler; uygulama sürümüyle birlikte incelemeye gönderilir. Sandbox hesabıyla test et.
- Mağaza açıklamasında abonelik metni ve gizlilik/koşullar bağlantıları bulunmalı (`store/listing.json` içinde hazır).

## 6. Limitler
Yönetim paneli → "Günlük sorgu limiti" (ücretsiz, varsayılan 10) ve "Premium günlük sorgu limiti" (varsayılan 300). Kullanıcıya özel `user_limits.daily_ai_limit` değeri her ikisini de geçersiz kılar.

## 7. Test akışı
1. Test hesabıyla Android'de Profil › BKNY Premium → Abone ol.
2. Birkaç saniye içinde kart "Premium üyesin" olmalı (RevenueCat → Customer History'de olaylar, Supabase `subscriptions` tablosunda satır).
3. Profil kartındaki "Bugünkü yapay zekâ kullanımın: x / 300" görünmeli.
Çalışmazsa: RevenueCat → Webhooks → son istek durumunu, Vercel loglarını ve `error_logs` tablosundaki `billing_webhook` kayıtlarını kontrol et.
