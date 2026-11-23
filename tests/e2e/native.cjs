// Mobil kabuk taklidi: Capacitor'ın yerel köprüsü (androidBridge + PluginHeaders) tarayıcıda taklit edilir ve
// uygulamanın bildirim akışı uçtan uca sınanır. Gerçek cihaz/simülatör testinin yerine geçmez.
//   node --env-file=.env.local tests/e2e/native.cjs
const { chromium, devices } = require("playwright");
const { createClient } = require("@supabase/supabase-js");
const assert = require("node:assert/strict");

const APP = process.env.APP_URL ?? "http://127.0.0.1:3000";
const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const email = `nat${Date.now()}@example.com`;
const errors = [];
let step = 0;
const ok = (n) => console.log(`  ✓ ${String(++step).padStart(2, "0")} ${n}`);

// Sahte yerel köprü: native-bridge.js'in sağladığı yüzey.
const FAKE_BRIDGE = ({ permission }) => {
  window.androidBridge = { postMessage() {} };
  const calls = [];
  const listeners = {};
  const methods = ["checkPermissions", "requestPermissions", "getToken", "deleteToken", "createChannel", "removeListener"].map((name) => ({ name, rtype: "promise" }));
  // Gerçek cihazda izin durumu uygulama yeniden açılsa da kalıcıdır.
  window.__native = { calls, state: { permission: localStorage.getItem('__perm') || permission }, fire: (event, data) => (listeners[event] ?? []).forEach((fn) => fn(data)) };
  window.Capacitor = {
    PluginHeaders: [{ name: "FirebaseMessaging", methods: [...methods, { name: "addListener", rtype: "callback" }] }],
    isNativePlatform: () => true,
    nativePromise(plugin, method, options) {
      calls.push([plugin, method]);
      const st = window.__native.state;
      if (method === "checkPermissions") return Promise.resolve({ receive: st.permission });
      if (method === "requestPermissions") {
        if (st.permission === "prompt") {
          st.permission = "granted";
          localStorage.setItem("__perm", "granted");
        }
        return Promise.resolve({ receive: st.permission });
      }
      if (method === "getToken") return Promise.resolve({ token: "FAKE-FCM-TOKEN-ABCDEFGHIJKLMNOPQRST" });
      return Promise.resolve();
    },
    nativeCallback(plugin, method, options, cb) {
      calls.push([plugin, method, options && options.eventName]);
      (listeners[options.eventName] = listeners[options.eventName] || []).push(cb);
      return `cb-${Object.keys(listeners).length}`;
    },
  };
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["Pixel 7"], locale: "tr-TR", timezoneId: "Europe/Istanbul" });
  await ctx.addInitScript(FAKE_BRIDGE, { permission: "prompt" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  page.on("dialog", (d) => d.accept());
  const tokens = async () => (await service.from("device_tokens").select("token, platform, user_id")).data.filter((t) => t.token.startsWith("FAKE-FCM"));

  // Kayıt + profil
  await page.goto(APP + "/register");
  await page.getByLabel("Ad", { exact: true }).fill("Nazlı");
  await page.getByLabel("Soyad").fill("Kaya");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre").fill("Test-parola-123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Kayıt ol" }).click();
  await page.waitForURL("**/onboarding");
  await page.getByLabel("Doğum tarihi").fill("1992-02-02");
  await page.getByRole("button", { name: "Kadın" }).click();
  await page.getByLabel("Boy (cm)").fill("166");
  await page.getByLabel("Kilo (kg)").fill("64");
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByLabel("Hedef kilo (kg)").fill("60");
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByRole("button", { name: "Başla" }).click();
  await page.getByRole("heading", { name: "Merhaba, Nazlı" }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.classList.contains("native")), "html.native sınıfı yok");
  assert.equal((await tokens()).length, 0, "izin verilmeden belirteç kaydedildi");
  ok("yerel kabuk algılandı (html.native); izin verilmeden belirteç kaydedilmedi");

  // Bildirimleri aç: izin iste → belirteç al → sunucuya kaydet
  await page.goto(APP + "/profile");
  await page.getByRole("button", { name: "Bu cihazda bildirimleri aç" }).click();
  await page.getByText("Bu cihazda bildirimler açık.").waitFor();
  const t1 = await tokens();
  assert.equal(t1.length, 1);
  assert.equal(t1[0].platform, "android");
  const calls = await page.evaluate(() => window.__native.calls.map((c) => c.join(":")));
  for (const c of ["FirebaseMessaging:requestPermissions", "FirebaseMessaging:getToken", "FirebaseMessaging:createChannel"]) assert.ok(calls.includes(c), `${c} çağrılmadı: ${calls}`);
  ok("izin istendi, Android kanalı oluşturuldu, belirteç sunucuya kaydedildi (platform: android)");

  // Açılışta belirteç yenileme: sunucudaki kayıt silinse bile uygulama açılınca geri gelir
  await service.from("device_tokens").delete().eq("token", t1[0].token);
  await page.goto(APP + "/");
  await page.getByRole("heading", { name: "Merhaba, Nazlı" }).waitFor();
  for (let i = 0; i < 30 && (await tokens()).length === 0; i++) await page.waitForTimeout(200);
  assert.equal((await tokens()).length, 1, "açılışta belirteç yenilenmedi");
  ok("uygulama açılınca (izin verilmişse) belirteç sessizce yenileniyor");

  // Bildirime dokunma
  await page.evaluate(() => window.__native.fire("notificationActionPerformed", { notification: { data: { url: "/water" } } }));
  await page.waitForURL("**/water");
  await page.getByRole("heading", { name: "Su takibi" }).waitFor();
  ok("bildirime dokunulunca ilgili sayfa açılıyor (/water)");
  for (const evil of ["https://evil.example/phish", "//evil.example", "javascript:alert(1)"]) {
    await page.evaluate((u) => window.__native.fire("notificationActionPerformed", { notification: { data: { url: u } } }), evil);
  }
  await page.waitForTimeout(500);
  assert.ok(page.url().startsWith(APP), `dış adrese yönlendirildi: ${page.url()}`);
  ok("bildirimden gelen dış/geçersiz adresler yok sayılıyor");

  // Çıkış: belirteç sunucudan silinmeli
  await page.goto(APP + "/profile");
  await page.getByRole("button", { name: "Çıkış yap" }).click();
  await page.waitForURL("**/login");
  for (let i = 0; i < 30 && (await tokens()).length > 0; i++) await page.waitForTimeout(200);
  assert.equal((await tokens()).length, 0, "çıkışta belirteç silinmedi");
  ok("çıkış yapınca bu cihazın belirteci sunucudan siliniyor");

  // Eklenti olmayan (eski) kabuk: anlaşılır mesaj
  const old = await browser.newContext({ ...devices["Pixel 7"], locale: "tr-TR" });
  await old.addInitScript(() => {
    window.androidBridge = { postMessage() {} };
    window.Capacitor = { PluginHeaders: [], isNativePlatform: () => true };
  });
  const p2 = await old.newPage();
  p2.on("dialog", (d) => d.accept());
  await p2.goto(APP + "/login");
  await p2.getByLabel("E-posta").fill(email);
  await p2.getByLabel("Şifre").fill("Test-parola-123");
  await p2.getByRole("button", { name: "Giriş yap" }).click();
  await p2.getByRole("heading", { name: "Merhaba, Nazlı" }).waitFor();
  await p2.goto(APP + "/profile");
  await p2.getByRole("button", { name: "Bu cihazda bildirimleri aç" }).click();
  await p2.getByText("Bildirimler için uygulamanın güncel sürümü gerekir.").waitFor();
  assert.equal((await tokens()).length, 0);
  await old.close();
  ok("bildirim eklentisi olmayan eski uygulama sürümünde anlaşılır uyarı, çökme yok");

  const { data } = await service.auth.admin.listUsers();
  for (const u of data.users.filter((x) => x.email === email)) await service.auth.admin.deleteUser(u.id);
  await browser.close();
  if (errors.length) {
    console.log("\nKonsol hataları:\n" + [...new Set(errors)].join("\n"));
    process.exit(1);
  }
  console.log(`\n${step} adım geçti, konsol hatası yok`);
})().catch((e) => {
  console.error(`\n✗ ${step + 1}. adımda hata: ${e.message.split("\n").slice(0, 6).join("\n")}`);
  if (errors.length) console.log([...new Set(errors)].join("\n"));
  process.exit(1);
});
