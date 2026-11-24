/** API hata kodlarını kullanıcıya gösterilecek Türkçe metne çevirir (çeviri t() ile yapılır). */
export function errorText(code: string, t: (s: string, v?: Record<string, string | number>) => string): string {
  switch (code) {
    case "offline":
      return t("İnternet bağlantısı yok. Yapay zekâ analizi için bağlantı gerekir; elle kayıt ekleyebilirsiniz.");
    case "unauthorized":
      return t("Oturumunuzun süresi doldu. Lütfen yeniden giriş yapın.");
    case "rate_limited":
      return t("Çok hızlı istek gönderdiniz. Bir dakika sonra tekrar deneyin.");
    case "daily_limit":
      return t("Günlük yapay zekâ sorgu limitinize ulaştınız. Yarın tekrar deneyin, elle kayıt ekleyin ya da Profil › Premium ile limitinizi artırın.");
    case "blocked":
      return t("Hesabınız için yapay zekâ özellikleri kapatılmış.");
    case "ai_disabled":
    case "ai_not_configured":
    case "server_not_configured":
      return t("Yapay zekâ servisi şu anda kullanılamıyor. Elle kayıt ekleyebilirsiniz.");
    case "timeout":
    case "ai_timeout":
      return t("Analiz zaman aşımına uğradı. Lütfen tekrar deneyin.");
    case "ai_busy":
      return t("Yapay zekâ servisi şu anda yoğun. Biraz sonra tekrar deneyin.");
    case "ai_blocked":
      return t("Bu içerik analiz edilemedi. Farklı bir fotoğraf veya ifade deneyin.");
    case "invalid_ai_response":
      return t("Analiz sonucu okunamadı. Lütfen tekrar deneyin.");
    case "not_found":
      return t("Bu barkod için ürün bulunamadı. Besin etiketinin fotoğrafını çekmeyi deneyin.");
    case "no_nutrition":
      return t("Ürün bulundu ancak besin değerleri kayıtlı değil. Besin etiketinin fotoğrafını çekmeyi deneyin.");
    case "bad_barcode":
      return t("Geçersiz barkod numarası.");
    case "image_decode_failed":
      return t("Fotoğraf okunamadı. Farklı bir görsel deneyin.");
    default:
      return t("Bir hata oluştu. Lütfen tekrar deneyin.");
  }
}
