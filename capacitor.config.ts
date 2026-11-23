import type { CapacitorConfig } from "@capacitor/cli";

/**
 * BKN yerel uygulama kabuğu (iOS ve Android).
 *
 * Uygulama sunucudan yüklenir (server.url); böylece web sürümü güncellendiğinde mağaza güncellemesi
 * beklemeden herkes yeni sürümü görür. Adres ortam değişkeniyle değiştirilebilir:
 *   CAP_SERVER_URL=https://bkny.com.tr npx cap sync
 * Yerel geliştirme sunucusunu simülatörde denemek için:
 *   iOS:     CAP_SERVER_URL=http://localhost:3000 npx cap sync ios
 *   Android: CAP_SERVER_URL=http://10.0.2.2:3000 npx cap sync android   (emülatörde 10.0.2.2 = bilgisayarınız)
 */
const serverUrl = process.env.CAP_SERVER_URL || "https://bkn-black.vercel.app";
const cleartext = serverUrl.startsWith("http://");

const config: CapacitorConfig = {
  appId: "tr.com.bkny.app",
  appName: "BKN",
  // server.url kullanıldığında bile bir webDir gerekir; bağlantı yokken gösterilen yedek sayfadır.
  webDir: "capacitor/www",
  server: {
    url: serverUrl,
    cleartext,
    // Yalnızca uygulamanın kendi alan adı ve Supabase uygulama içinde açılır; diğer bağlantılar sistem tarayıcısına gider.
    allowNavigation: ["*.supabase.co", "bkny.com.tr", "*.bkny.com.tr", "bkn-black.vercel.app"],
  },
  backgroundColor: "#f6f8f7",
  ios: {
    contentInset: "always",
    scheme: "BKN",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: { launchShowDuration: 1200, launchAutoHide: true, backgroundColor: "#1f9d76", showSpinner: false },
    StatusBar: { style: "DEFAULT", overlaysWebView: false },
    Keyboard: { resize: "body", resizeOnFullScreen: true },
  },
};

export default config;
