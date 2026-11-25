# Yönetim paneli (/admin)

Yalnızca yöneticiler görür. Kişisel sağlık kayıtlarının içeriği (öğün, ölçüm, not, fotoğraf) panelde ASLA gösterilmez; yalnızca hesap bilgisi, kullanım sayaçları, kayıt SAYILARI ve plan bilgisi vardır.

## Yönetici hesapları
`info@secesta.com` ve `secestasoftware@gmail.com` iki yoldan yönetici olur:
1. Vercel'de `ADMIN_EMAILS` ortam değişkenine ekle (virgülle ayrılmış; e-postası **doğrulanmış** hesaplar için geçerli): `ADMIN_EMAILS=info@secesta.com,secestasoftware@gmail.com` (başka adresler varsa onları koru). Ekledikten sonra yeniden deploy et.
2. Migration `20261208100000_admin_plans.sql` bu iki hesap kayıtlıysa `admins` tablosuna da ekler (hesap henüz yoksa panelden "Yönetici yap" ile eklenir).

## Sekmeler
- **Kullanıcılar:** tüm hesaplar (50'şer, "Daha fazla yükle"), arama, filtre (Tümü / Premium / Ücretsiz / Yönetici). Her kartta: Premium kaynağı (Kurucu, Abonelik, Elle Premium), abonelik ayrıntısı, özellik bazında yapay zekâ kullanımı (30 gün + bugün), kayıt sayıları, kullanıcıya özel günlük limit, **Premium ver / kaldır**, YZ erişimini engelle, yönetici yap, sil.
- **Planlar:** her yapay zekâ özelliği için plan ve limitler. **Herkese açık** (ücretsiz üyeler de kullanır) ya da **Premium'a özel**; ücretsiz ve Premium için günlük limit (boş = sınırsız, 0 = kapalı); bugünkü ve 30 günlük kullanım. Yapay zekâ kullanmayan özellikler (barkod, su, uyku vb.) herkese açık ve sınırsız olarak listelenir; plana göre kısıtlanmaz.
- **Ayarlar:** genel günlük yapay zekâ limiti (ücretsiz ve Premium), dakikalık limit, model ve fiyatlar.

## Limitler nasıl çalışır (sıra)
1. Kullanıcıya özel `daily_ai_limit` varsa o; yoksa plan limiti (Premium: `premium_daily_ai_limit`, ücretsiz: `default_daily_ai_limit`) — tüm özelliklerin toplamı.
2. Özellik "Premium'a özel" ise ücretsiz üye `premium_required` (403) alır.
3. Özellik limiti: üyenin planına göre günlük çağrı sayısı; dolunca `feature_limit` (429).
İkisinden biri dolunca kullanım durur. Önbellekten gelen cevaplar sayılmaz.

## Premium kaynakları
- **Kurucu:** `PREMIUM_EMAILS` ortam değişkeni (her zaman Premium).
- **Elle Premium:** panelden verilir (`user_limits.premium_override`), not eklenebilir; abonelik olmadan.
- **Abonelik:** RevenueCat webhook'u (`subscriptions`).

## Kurulum
1. `supabase/migrations/20261208100000_admin_plans.sql` dosyasını SQL Editor'da çalıştır.
2. `ADMIN_EMAILS` değişkenini güncelle ve yeniden deploy et.
Migration uygulanmadan da panel açılır; yeni sütunlar (özellik bazlı kullanım, kayıt sayıları, Elle Premium) migration sonrası dolar.

## Varsayılan plan sayıları (tanıtım ve mağaza metinleriyle aynı)
Ücretsiz: genel günlük **20** yapay zekâ analizi; özellik başına fotoğraf 5, yazı 10, etiket 5, asistan 5, buzdolabı 2, tarif 2, menü 2, halka 3, haftalık mektup 1; haftalık öğün planı Premium'a özel.
Premium: genel günlük **300**; fotoğraf 100, yazı 200, etiket 100, asistan 100, buzdolabı 30, tarif 50, plan 10, menü 30, halka 20, mektup 3.
Bunlar yalnızca varsayılandır; Planlar ve Ayarlar sekmelerinde değiştirilen değer önceliklidir. **Sayıları panelden değiştirirsen tanıtım sayfası (`src/components/landing.tsx`), mağaza metinleri (`store/listing.json`) ve `public/llms.txt` içindeki rakamları da güncelle.**
