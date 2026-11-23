// Uçtan uca tarayıcı testi (Playwright). Ön koşullar tests/integration/run.mjs ile aynıdır.
//   node --env-file=.env.local tests/e2e/run.cjs [ekran-görüntüsü-klasörü]
const { chromium, devices } = require("playwright");
const { createClient } = require("@supabase/supabase-js");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const APP = process.env.APP_URL ?? "http://127.0.0.1:3000";
const SHOTS = process.argv[2] || path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });
const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const email = `e2e${Date.now()}@example.com`;
const password = "Test-parola-123";
const errors = [];
let step = 0;
const ok = (name) => console.log(`  ✓ ${String(++step).padStart(2, "0")} ${name}`);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "tr-TR", timezoneId: "Europe/Istanbul", acceptDownloads: true });
  // Konuşma tanıma başsız tarayıcıda yoktur; arayüz akışını sınamak için taklit edilir.
  await ctx.addInitScript(() => {
    window.SpeechRecognition = window.webkitSpeechRecognition = class {
      start() {
        setTimeout(() => {
          this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: "1 bardak ayran" }], { isFinal: true })] });
          setTimeout(() => this.onend?.(), 400);
        }, 500);
      }
      stop() {
        this.onend?.();
      }
    };
  });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource|net::ERR_INTERNET_DISCONNECTED|ERR_FAILED/.test(m.text()) && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("dialog", (d) => d.accept());
  const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
  const toastGone = () => page.locator('[role="status"]').first().waitFor({ state: "detached", timeout: 8000 }).catch(() => {});

  // Test bir dakikadan kısa sürede 6'dan fazla YZ çağrısı yapıyor; dakikalık hız limitini test süresince yükselt.
  // (Limitin kendisi tests/integration içinde ayrıca doğrulanıyor.)
  await service.from("app_settings").upsert({ key: "per_minute_limit", value: 100 });
  await new Promise((r) => setTimeout(r, 31_000)); // sunucudaki ayar önbelleğinin (30 sn) yenilenmesini bekle

  // 1. Korumalı sayfa girişe yönlendirir
  await page.goto(APP + "/diary");
  await page.waitForURL("**/login");
  ok("oturumsuz kullanıcı giriş sayfasına yönlenir");
  // Ana adreste ziyaretçiye tanıtım sayfası gösterilir (arama motorları için); oradan giriş sayfasına gidilir.
  await page.goto(APP + "/");
  await page.getByRole("heading", { level: 1, name: "Bugün kendin için ne yaptın?" }).waitFor();
  await page.getByRole("link", { name: "Giriş yap" }).first().click();
  await page.waitForURL("**/login");
  ok("ana adres ziyaretçiye tanıtım sayfasını gösterir");

  // 2. Kayıt doğrulamaları
  await page.goto(APP + "/register");
  await page.getByLabel("Ad", { exact: true }).fill("Ayşe");
  await page.getByLabel("Soyad").fill("Yılmaz");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre").fill("kisa");
  await page.getByRole("button", { name: "Kayıt ol" }).click();
  await page.getByText("Şifre en az 8 karakter olmalı.").waitFor();
  await page.getByLabel("Şifre").fill(password);
  await page.getByRole("button", { name: "Kayıt ol" }).click();
  await page.getByText("aydınlatma metnini onaylamalısınız").waitFor();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Kayıt ol" }).click();
  await page.waitForURL("**/onboarding");
  ok("kayıt formu doğrulama yapar ve hesabı oluşturur");

  // 3. Başlangıç sihirbazı
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByText("Cinsiyet seçin.").waitFor();
  await page.getByLabel("Doğum tarihi").fill("1992-05-14");
  await page.getByRole("button", { name: "Kadın" }).click();
  await page.getByLabel("Boy (cm)").fill("165");
  await page.getByLabel("Kilo (kg)").fill("68");
  await shot("01-onboarding");
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByLabel("Hedef kilo (kg)").fill("75");
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByText("hedef kilo mevcut kilodan düşük olmalı").waitFor();
  await page.getByLabel("Hedef kilo (kg)").fill("62");
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByRole("button", { name: "Gluten", exact: true }).click();
  await page.getByRole("button", { name: "Akdeniz tipi" }).click();
  // 68 kg, 165 cm, 34 yaş kadın, az hareketli, haftada 0,5 kg: BMR 1380 → TDEE 1898 → −550 → 1350
  await page.getByText(/^1350\b/).waitFor();
  await shot("02-onboarding-hedefler");
  await page.getByRole("button", { name: "Başla" }).click();
  await page.getByRole("heading", { name: "Merhaba, Ayşe" }).waitFor();
  await page.getByText("Bugün henüz kayıt yok").waitFor();
  await shot("03-ana-sayfa-bos");
  ok("başlangıç sihirbazı hedefleri hesaplar; boş panelde sahte veri yok");

  // 4. Yazıyla ekleme
  await page.getByRole("button", { name: "Yazarak", exact: true }).click();
  await page.getByLabel("Ne yediniz?").fill(`2 haşlanmış yumurta, 2 dilim ekmek ${Date.now()}`);
  await page.getByRole("button", { name: "Besin değerlerini hesapla" }).click();
  await page.getByText("Referans tablo").first().waitFor();
  await page.getByText("Tahmini", { exact: true }).first().waitFor();
  await shot("04-yazi-inceleme");
  // Gramajı değiştirince değerler orantılanır: 100 g yumurta 155 kcal → 200 g 310 kcal
  const firstCard = page.locator(".rounded-2xl.border.bg-surface.p-3").first();
  await firstCard.getByLabel("Miktar (g / ml)").fill("200");
  assert.equal(await firstCard.getByLabel("Kalori (kcal)").inputValue(), "310");
  await page.getByRole("button", { name: "Kahvaltı", exact: true }).click();
  await page.getByLabel("Favorilere ekle").check();
  await page.getByRole("button", { name: "Onayla ve ekle" }).click();
  await page.waitForURL("**/diary**");
  await page.getByText("Haşlanmış yumurta").waitFor();
  await page.getByText("Ev yapımı özel sos").waitFor();
  ok("yazıyla ekleme: analiz, düzenleme, orantılama, onay ve günlüğe kayıt");

  // 5. Kaydı düzenle
  await page.getByText("Ev yapımı özel sos").click();
  await page.getByLabel("Kalori (kcal)").fill("120");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await page.getByText("Kayıt güncellendi.").waitFor();
  await shot("05-gunluk");
  ok("kayıt düzenleme");

  // 6. Öğünü dünkü güne kopyala, sonra kopyalardan birini sil
  await toastGone();
  await page.getByRole("button", { name: "Öğünü başka güne kopyala" }).click();
  await page.getByRole("button", { name: "Kopyala", exact: true }).click();
  await page.getByText("3 kayıt kopyalandı.").waitFor();
  await page.getByRole("button", { name: "Önceki gün" }).click();
  await page.getByText("Dün").waitFor();
  await page.getByText("Beyaz ekmek").click();
  await page.getByRole("button", { name: "Sil", exact: true }).click();
  await page.getByText("Kayıt silindi.").waitFor();
  assert.equal(await page.getByText("Beyaz ekmek").count(), 0);
  ok("geçmiş güne kopyalama ve silme");

  // 7. Fotoğrafla ekleme (kamera girdisi) + porsiyon sorusu
  await page.goto(APP + "/add");
  const jpg = path.join(SHOTS, "_meal.jpg");
  const p2 = await ctx.newPage();
  await p2.setContent('<canvas id="c" width="640" height="480"></canvas><script>const x=document.getElementById("c").getContext("2d");x.fillStyle="#d8c9a8";x.fillRect(0,0,640,480);x.fillStyle="#fff";x.beginPath();x.arc(320,240,200,0,7);x.fill();x.fillStyle="#b5651d";x.fillRect(250,190,140,90);</script>');
  await p2.locator("#c").screenshot({ path: jpg, type: "jpeg" });
  await p2.close();
  await page.locator("#bt-camera-input").setInputFiles(jpg);
  await page.getByText("Porsiyondan emin olamadım").waitFor();
  await page.getByText("Pilav yaklaşık kaç kaşık").waitFor();
  await page.getByText("Düşük güven").first().waitFor();
  assert.equal(await page.locator('input[aria-label="Yiyecek adı"]').count(), 4);
  await shot("06-foto-porsiyon-sorusu");
  await page.getByPlaceholder("Örn. pilav 1 su bardağı").fill("pilav 1 su bardağı");
  await page.getByRole("button", { name: "Yeniden hesapla" }).click();
  await page.getByText("Porsiyondan emin olamadım").waitFor({ state: "detached" });
  assert.equal(await page.locator(".rounded-2xl.border.bg-surface.p-3").first().getByLabel("Miktar (g / ml)").inputValue(), "200");
  await page.getByRole("button", { name: "Öğle yemeği", exact: true }).click();
  await page.getByRole("button", { name: "Onayla ve ekle" }).click();
  await page.waitForURL("**/diary**");
  await page.getByText("Izgara tavuk göğsü").waitFor();
  const { data: withPhoto } = await service.from("food_entries").select("photo_path, user_id").eq("name", "Izgara tavuk göğsü").order("created_at", { ascending: false }).limit(1);
  assert.match(withPhoto[0].photo_path, new RegExp(`^${withPhoto[0].user_id}/.+\\.jpg$`));
  ok("fotoğraf analizi: 4 ayrı kalem, porsiyon sorusu, yeniden hesaplama, fotoğraf özel depoya yüklendi");

  // 8. Favoriden ekleme
  await page.goto(APP + "/add?mode=favorites");
  await page.getByText("Kahvaltı").first().click();
  await page.getByRole("button", { name: "Ara öğün", exact: true }).click();
  await page.getByRole("button", { name: "Onayla ve ekle" }).click();
  await page.waitForURL("**/diary**");
  ok("favoriden tek dokunuşla ekleme");

  // 9. Su
  await page.goto(APP + "/water");
  await page.getByRole("button", { name: "500 ml", exact: true }).click();
  await page.getByText("500 ml su eklendi").waitFor();
  await page.getByRole("button", { name: "Özel miktar" }).click();
  await page.getByLabel("Miktar (ml)").fill("175");
  await page.getByRole("button", { name: "Ekle", exact: true }).click();
  await page.getByText("675 / 2.250 ml").waitFor();
  await page.getByText("30%").waitFor();
  await shot("07-su");
  ok("su: hızlı ve özel miktar ekleme, ilerleme yüzdesi");

  // 10. İçecek (alkol) — suya sayılmaz
  await page.goto(APP + "/drinks");
  await page.getByRole("button", { name: "Bira", exact: true }).click();
  await page.getByRole("button", { name: "500 ml", exact: true }).click();
  await page.getByText("19,7").first().waitFor();
  await page.getByRole("button", { name: "İçeceği ekle" }).click();
  await page.getByText("İçecek eklendi.").waitFor();
  await page.getByText("2 standart içki").waitFor();
  await shot("08-icecek");
  ok("içecek: saf alkol ve kalori hesabı, haftalık özet");

  // 11. Aktivite + adım
  await page.goto(APP + "/activity");
  await page.getByRole("button", { name: "Koşu", exact: true }).click();
  await page.getByLabel("Süre (dakika)").fill("30");
  await page.getByLabel("Mesafe (km)").fill("5");
  await page.getByText("299 kcal").waitFor(); // (9,8 − 1) MET × 68 kg × 0,5 sa
  await page.getByRole("button", { name: "Aktiviteyi kaydet" }).click();
  await page.getByText("Aktivite eklendi.").waitFor();
  await page.getByLabel("Adım sayısı").fill("9000");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await page.getByText("Adım sayısı kaydedildi.").waitFor();
  await shot("09-aktivite");
  ok("aktivite: hıza göre MET, kiloya göre net kalori; adım kaydı");

  // 12. Ölçüm
  await toastGone();
  await page.goto(APP + "/body");
  await page.getByLabel("Kilo (kg)").fill("67.2");
  await page.getByLabel("Bel çevresi (cm)").fill("78");
  await page.getByRole("button", { name: "Ölçümü kaydet" }).click();
  await page.getByText("Ölçüm kaydedildi.").waitFor();
  await page.getByText("-0,8").waitFor();
  await page.getByText("Hedefe ilerleme: %13").waitFor();
  await shot("10-olcumler");
  ok("ölçüm: VKİ, toplam değişim ve hedef ilerlemesi");

  // 13. Uyku ve durum
  await toastGone();
  await page.goto(APP + "/wellbeing");
  await page.getByLabel("Uyku süresi (saat)").fill("7.5");
  await page.getByRole("radiogroup").nth(1).getByRole("radio", { name: "İyi", exact: true }).click();
  await page.getByLabel("Günlük not").fill("Dinç uyandım.");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await page.getByText("Kaydedildi.").waitFor();
  ok("uyku ve günlük durum kaydı");


  // BKNY-1. Takviyeler
  await toastGone();
  await page.goto(APP + "/supplements");
  await page.getByText("Henüz takviye eklemediniz").waitFor();
  await page.getByRole("button", { name: "Takviye ekle" }).click();
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await page.getByText("Takviye adını girin.").waitFor();
  await page.getByLabel("Takviye adı").fill("D vitamini");
  await page.getByLabel("Doz").fill("1000 IU");
  await page.getByLabel("Saat 1").fill("00:05");
  await page.getByRole("button", { name: "Saat ekle" }).click();
  await page.getByLabel("Saat 2").fill("23:55");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await page.getByText("Takviye kaydedildi.").waitFor();
  await page.getByText("0 / 2").waitFor();
  await page.getByText("saati geçti").waitFor();
  await page.getByRole("checkbox", { name: "D vitamini 00:05" }).click();
  await page.getByText("Harika! D vitamini tamamlandı.").waitFor();
  await page.getByText("1 / 2").waitFor();
  await shot("21-takviyeler");
  ok("takviye: ad/doz/saat ekleme, doğrulama, alındı işaretleme");

  // BKNY-2. Sağlık halkaları: ekran görüntüsünden okuma
  await toastGone();
  await page.goto(APP + "/rings");
  await page.getByText("Bu gün için halka kaydı yok").waitFor();
  await page.locator("#bkn-rings-gallery").setInputFiles(jpg);
  await page.getByText("Değerler okundu. Kontrol edip kaydedin.").waitFor();
  assert.equal(await page.getByLabel("Hareket (kcal)").inputValue(), "420");
  assert.equal(await page.getByLabel("Egzersiz hedefi").inputValue(), "30");
  assert.equal(await page.getByLabel("Adım", { exact: true }).inputValue(), "7350");
  await page.getByLabel("Hareket (kcal)").fill("450");
  await page.getByRole("img", { name: "Sağlık halkaları" }).first().waitFor();
  await page.getByRole("button", { name: "Günlüğe kaydet" }).click();
  await page.getByText("Halkalar günlüğe kaydedildi.").waitFor();
  await shot("22-saglik-halkalari");
  await page.goto(APP + "/diary");
  await page.getByText("450/500").waitFor();
  ok("sağlık halkaları: ekran görüntüsü okundu, düzenlendi, halka grafiği günlüğe yazıldı");

  // BKNY-3. Öneriler ve tarifler
  await page.goto(APP + "/coach");
  await page.getByText("Bugünkü protein").waitFor();
  await page.getByText("Son 3 günün eğilimi").waitFor();
  await page.getByRole("button", { name: "Lifli" }).click();
  await page.getByText("Ton balıklı nohut salatası").waitFor();
  // Profilde gluten alerjisi var: glutenli tarifler önerilmemeli.
  assert.equal(await page.getByText("Izgara tavuklu bulgur tabağı").count(), 0);
  await page.getByRole("button", { name: "Tarifi gör" }).first().click();
  await page.getByRole("button", { name: "Gizle" }).waitFor();
  await page.getByRole("button", { name: "Yapay zekâdan bana özel tarif iste" }).click();
  await page.getByText("Yoğurtlu tavuklu dürüm").waitFor();
  await page.getByText("Size özel").waitFor();
  await shot("23-oneriler");
  await page.getByRole("button", { name: "Günlüğe ekle" }).first().click();
  await page.getByText("Günlüğe eklendi.").waitFor();
  ok("öneriler: protein durumu, eğilim, etiketli tarifler, kişisel tarif ve günlüğe ekleme");

  // BKNY-4. Performans özeti + PDF / PNG
  await toastGone();
  await page.goto(APP + "/performance");
  await page.getByRole("columnheader", { name: "3 haftalık" }).waitFor();
  await page.getByRole("rowheader", { name: "Takviye düzeni" }).waitFor();
  await shot("24-performans");
  for (const [label, magic] of [["PDF", "%PDF"], ["PNG", "\x89PNG"]]) {
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: label, exact: true }).click()]);
    const file = path.join(SHOTS, `_performans.${label.toLowerCase()}`);
    await dl.saveAs(file);
    const buf = fs.readFileSync(file);
    assert.ok(buf.toString("latin1", 0, 4) === magic && buf.length > 15000, `${label} beklenmedik`);
  }
  ok("performans: 5 dönem bir arada, PDF ve PNG indirme");

  // BKNY-5. Bildirim ayarları
  await page.goto(APP + "/profile");
  await page.getByRole("heading", { name: "Bildirimler" }).waitFor();
  await page.getByLabel("Alınmayan takviye için tekrar sıklığı").selectOption("15");
  await page.getByRole("switch", { name: "Eğilim uyarıları" }).click();
  await page.waitForTimeout(600);
  const { data: np } = await service.from("profiles").select("supplement_nag_min, notify_insights, notify_supplements").eq("first_name", "Ayşe").order("created_at", { ascending: false }).limit(1).single();
  assert.deepEqual(np, { supplement_nag_min: 15, notify_insights: false, notify_supplements: true });
  ok("bildirim ayarları: tekrar sıklığı ve tür bazında aç/kapat kaydediliyor");


  // EK-1. Takviye stoku
  await page.goto(APP + "/supplements");
  await page.getByRole("button", { name: "Düzenle" }).click();
  await page.getByLabel("Kutuda kalan adet").fill("4");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await page.getByText("Stok: 4 adet · yaklaşık 2 gün · azalıyor").waitFor();
  await page.getByRole("checkbox", { name: "D vitamini 00:05" }).click();
  await page.getByText("Stok: 5 adet").waitFor();
  await page.getByRole("checkbox", { name: "D vitamini 00:05" }).click();
  await page.getByText("Stok: 4 adet").waitFor();
  ok("takviye stoku: alınca düşüyor, geri alınca iade ediliyor, azalınca uyarıyor");

  // EK-2. Kafein
  await toastGone();
  await page.goto(APP + "/drinks");
  await page.getByRole("button", { name: "Kahve (sade)", exact: true }).click();
  await page.getByText("Kafein", { exact: true }).waitFor();
  await page.getByRole("button", { name: "İçeceği ekle" }).click();
  await page.getByText("İçecek eklendi.").waitFor();
  await page.getByText("80 / 400 mg").waitFor();
  await page.getByText(/kafein 80 mg/).waitFor();
  await shot("25-kafein");
  ok("kafein: içecekten hesaplanıyor, günlük sınırla gösteriliyor");

  // EK-3. Aralıklı oruç
  await toastGone();
  await page.goto(APP + "/fasting");
  await page.getByRole("button", { name: "14:10" }).click();
  await page.getByLabel("Başlangıç zamanı").fill(await page.evaluate(() => { const d = new Date(Date.now() - 15 * 3600e3); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }));
  await page.getByRole("button", { name: "Orucu başlat" }).click();
  await page.getByText("Oruç başladı. Kolay gelsin!").waitFor();
  await page.getByText("15 sa 00 dk").or(page.getByText("15 sa 01 dk")).first().waitFor();
  await page.getByText("Hedef tamamlandı").waitFor();
  await shot("26-oruc");
  await page.getByRole("button", { name: "Orucu bitir" }).click();
  await page.getByText("Tebrikler, hedefini tamamladın!").waitFor();
  await page.getByText("hedef tamam", { exact: false }).first().waitFor();
  await page.getByText("1/1").waitFor();
  ok("aralıklı oruç: geçmiş saatten başlatma, sayaç, hedef ve geçmiş");

  // EK-4. Haftalık öğün planı ve alışveriş listesi
  await toastGone();
  await page.goto(APP + "/plan");
  await page.getByText("Henüz planınız yok").waitFor();
  await page.getByRole("button", { name: "Plan oluştur" }).click();
  await page.getByText("Haftalık planınız hazır.").waitFor();
  await page.getByText("Lorlu menemen, 1 dilim tam buğday ekmeği (gün 1)").waitFor();
  await page.getByText("1410 kcal · protein 105 g").waitFor();
  await page.getByRole("button", { name: /3\. gün/ }).click();
  await page.getByText("(gün 3)").waitFor();
  await page.getByRole("button", { name: /Ayran ve bir avuç leblebi: günlüğe ekle/ }).click();
  await page.getByText("Günlüğe eklendi.").waitFor();
  await shot("27-ogun-plani");
  await page.getByRole("tab", { name: /Alışveriş listesi \(0\/7\)/ }).click();
  await page.getByRole("checkbox", { name: "Tavuk göğsü 1 kg" }).click();
  await page.getByRole("tab", { name: /Alışveriş listesi \(1\/7\)/ }).waitFor();
  await page.reload();
  await page.getByRole("tab", { name: /Alışveriş listesi \(1\/7\)/ }).waitFor();
  ok("öğün planı: 7 gün, günlüğe ekleme, işaretlenebilir ve kalıcı alışveriş listesi");

  // EK-5. Diyetisyen paylaşımı
  await toastGone();
  await page.goto(APP + "/sharing");
  assert.ok(await page.getByRole("button", { name: "Bağlantı oluştur" }).isDisabled(), "onaysız bağlantı oluşturulabiliyor");
  await page.getByLabel("Kiminle paylaşıyorsunuz? (isteğe bağlı)").fill("Dyt. Elif");
  // Sayfada önce "Diyetisyenime bağlan" formu var; rapor bağlantısı formu ikinci sırada.
  await page.getByRole("switch", { name: "Kilo ve vücut ölçümleri" }).last().click();
  await page.getByRole("checkbox").last().check();
  await page.getByRole("button", { name: "Bağlantı oluştur" }).click();
  const shareUrl = await page.getByLabel("Paylaşım bağlantısı").inputValue();
  assert.match(shareUrl, /\/share\/[A-Za-z0-9_-]{40,}$/);
  await page.getByText("Henüz görüntülenmedi").waitFor();
  const guestCtx = await browser.newContext({ viewport: { width: 1100, height: 900 }, locale: "tr-TR" });
  const guest = await guestCtx.newPage();
  guest.on("pageerror", (e) => errors.push(`guest pageerror: ${e.message}`));
  await guest.goto(shareUrl);
  await guest.getByRole("heading", { name: "Ayşe · paylaşılan rapor" }).waitFor();
  await guest.getByText("Salt okunur").waitFor();
  await guest.getByRole("heading", { name: "Öğün ayrıntıları" }).waitFor();
  await guest.getByText("Izgara tavuk göğsü").first().waitFor();
  assert.equal(await guest.getByRole("heading", { name: "Kilo değişimi" }).count(), 0, "kapatılan kilo bölümü görünüyor");
  const guestText = await guest.locator("body").innerText();
  for (const secret of ["Yılmaz", email, "Dinç uyandım"]) assert.ok(!guestText.includes(secret), `${secret} paylaşılan raporda görünüyor`);
  await guest.screenshot({ path: path.join(SHOTS, "28-paylasilan-rapor.png"), fullPage: true });
  await guest.goto(APP + "/diary");
  await guest.waitForURL("**/login");
  await page.reload();
  await page.getByText(/1 kez görüntülendi/).waitFor();
  await page.getByRole("button", { name: "İptal et" }).click();
  await page.getByText("Bağlantı iptal edildi.").waitFor();
  await guest.goto(shareUrl);
  await guest.getByText("Bağlantı geçersiz", { exact: false }).waitFor();
  await guestCtx.close();
  ok("paylaşım: rıza zorunlu, oturumsuz salt okunur rapor, kapatılan bölüm ve kimlik bilgisi yok, iptal anında geçersiz");

  // EK-6. Seri ve rozetler, akşam kapanışı ayarı
  await toastGone();
  await page.goto(APP + "/performance");
  await page.getByText("Güncel seri: 2 gün").waitFor();
  await page.getByText(/Rozetler \(\d+\/12\)/).waitFor();
  assert.equal(await page.locator('li[data-earned="true"]').filter({ hasText: "İlk adım" }).count(), 1);
  assert.equal(await page.locator('li[data-earned="true"]').filter({ hasText: "30 günlük seri" }).count(), 0);
  await shot("29-rozetler");
  await page.goto(APP + "/profile");
  await page.getByLabel("Kapanış saati").selectOption("22");
  await page.waitForTimeout(600);
  const { data: ev } = await service.from("profiles").select("evening_hour, notify_evening").eq("first_name", "Ayşe").order("created_at", { ascending: false }).limit(1).single();
  assert.deepEqual(ev, { evening_hour: 22, notify_evening: true });
  ok("seri ve rozetler hesaplanıyor; akşam kapanışı saati kaydediliyor");


  // YENİ-1. Sesle ekleme (tarayıcının konuşma tanıması testte taklit edilir)
  await toastGone();
  await page.goto(APP + "/add");
  await page.getByRole("button", { name: /Sesle ekle/ }).click();
  await page.getByRole("button", { name: /Dinleniyor/ }).waitFor();
  await page.waitForFunction(() => document.querySelector("textarea")?.value.includes("1 bardak ayran"));
  await page.getByRole("button", { name: "Sesle söyle" }).waitFor();
  ok("sesle ekleme: konuşma metne çevrilip yazı alanına geliyor");

  // YENİ-2. Tariflerim
  await page.goto(APP + "/recipes");
  await page.getByText("Henüz tarifiniz yok").waitFor();
  await page.getByRole("button", { name: "Yeni tarif" }).click();
  await page.getByLabel("Tarif adı").fill("Annemin tarifi");
  await page.getByLabel("Kaç porsiyon?").fill("4");
  await page.getByLabel("Malzemeler").fill(`2 yumurta, 2 dilim ekmek, sos ${Date.now()}`);
  await page.getByRole("button", { name: "Malzemeleri hesapla" }).click();
  await page.getByText("378 kcal").waitFor();
  await page.getByText(/1 porsiyon:\s*95 kcal/).waitFor();
  await page.getByRole("button", { name: "Tarifi kaydet" }).click();
  await page.getByText("Tarif kaydedildi.").waitFor();
  await page.getByRole("button", { name: "Ekle", exact: true }).click();
  await page.getByLabel("Kaç porsiyon yediniz?").fill("2");
  await page.getByRole("button", { name: "Günlüğe ekle" }).click();
  await page.getByText("Günlüğe eklendi.").waitFor();
  const { data: recipeEntry } = await service.from("food_entries").select("kcal, quantity, micros").eq("name", "Annemin tarifi").order("created_at", { ascending: false }).limit(1).single();
  assert.equal(Number(recipeEntry.kcal), 189);
  assert.equal(Number(recipeEntry.quantity), 2);
  assert.ok(recipeEntry.micros && recipeEntry.micros.iron_mg > 0, "tarifin mikro besinleri kayda geçmedi");
  await shot("30-tariflerim");
  ok("tariflerim: malzemelerden toplam ve porsiyon başı hesap, porsiyonla günlüğe ekleme");

  // YENİ-3. Öğünü tekrarla kısayolu
  await toastGone();
  const tz = (off) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date(Date.now() - off * 86400e3));
  const { data: me0 } = await service.from("profiles").select("id").eq("first_name", "Ayşe").order("created_at", { ascending: false }).limit(1).single();
  await service.from("food_entries").insert({ user_id: me0.id, entry_date: tz(2), meal: "lunch", name: "Dünden kalan mantı", kcal: 420, protein_g: 18, carbs_g: 50, fat_g: 16 });
  await page.goto(`${APP}/diary?date=${tz(1)}`);
  await page.getByRole("button", { name: /Tekrarla · bir önceki gün · Dünden kalan mantı/ }).click();
  await page.getByText("1 kayıt eklendi.").waitFor();
  await page.getByRole("button", { name: /Dünden kalan mantı/ }).first().waitFor();
  assert.equal(await page.getByRole("button", { name: /Tekrarla · bir önceki gün · Dünden kalan mantı/ }).count(), 0);
  ok("öğün tekrarlama: boş öğünde önceki günün kaydı tek dokunuşla ekleniyor");

  // YENİ-4. Haftalık mektup
  await toastGone();
  await page.goto(APP + "/letter");
  await page.getByRole("button", { name: "Mektubumu oluştur" }).click();
  await page.getByText(/Merhaba Ayşe, bu hafta \d+ gün kayıt girdin/).waitFor();
  await page.reload();
  await page.getByText(/Merhaba Ayşe, bu hafta/).waitFor();
  assert.equal(await page.getByRole("button", { name: "Mektubumu oluştur" }).count(), 0);
  await shot("31-mektup");
  ok("haftalık mektup: kayıtlara dayalı mektup oluşuyor ve saklanıyor");

  // YENİ-5. Meydan okuma
  await page.goto(APP + "/challenges");
  await page.getByRole("button", { name: "Yeni başlat" }).click();
  await page.getByLabel("Başlık").fill("7 gün her gün kayıt");
  await page.getByRole("button", { name: "Her gün kayıt", exact: true }).click();
  await page.getByRole("button", { name: "Başlat", exact: true }).click();
  await page.getByText("Meydan okuma başladı!", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Daveti paylaş" }).waitFor();
  assert.match(await page.getByRole("button", { name: "Daveti paylaş" }).innerText(), /^[A-Z2-9]{8}/);
  await page.getByText("1 / 7 gün").waitFor();
  await page.getByText("(siz)").waitFor();
  await shot("32-meydan-okuma");
  ok("meydan okuma: başlatma, katılım kodu, kendi ilerlemesi sunucudan");

  // YENİ-6. Döngü takibi
  await toastGone();
  await page.goto(APP + "/cycle");
  await page.getByLabel("Başlangıç").fill(tz(20));
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await page.getByText("Kaydedildi.").waitFor();
  await page.getByRole("img", { name: "Döngünün 21. günü" }).waitFor();
  await page.getByText("Luteal evre").waitFor();
  await page.getByText("28 günlük varsayılan döngü kullanılıyor", { exact: false }).waitFor();
  await shot("33-dongu");
  ok("döngü takibi: gün, evre ve sonraki tahmin");

  // YENİ-7. Dışarıda yemek
  await toastGone();
  await page.goto(APP + "/eating-out");
  await page.locator("#bkn-menu-gallery").setInputFiles(jpg);
  await page.getByText("Tavuk Şiş").waitFor();
  await page.getByText("Önerilir").waitFor();
  assert.equal(await page.getByText("Kıymalı Pide").count(), 0);
  await page.getByRole("tab", { name: "Tüm menü (3)" }).click();
  await page.getByText("Kıymalı Pide").waitFor();
  await page.getByText("Alerjeniniz içerebilir", { exact: false }).waitFor();
  await shot("34-disarida-yemek");
  await page.getByRole("button", { name: "Bunu yedim, günlüğe ekle" }).first().click();
  await page.getByText("Günlüğe eklendi.").waitFor();
  ok("dışarıda yemek: menü okundu, öneri sıralaması, alerjen uyarısı, günlüğe ekleme");

  // YENİ-8. Ramazan modu
  await toastGone();
  await page.goto(APP + "/profile");
  await page.getByRole("switch", { name: "Ramazan modu" }).click();
  await page.getByLabel("İftar saati").waitFor();
  await page.goto(APP + "/diary");
  await page.getByRole("heading", { name: "Sahur" }).waitFor();
  await page.getByRole("heading", { name: "İftar" }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Kahvaltı" }).count(), 0);
  await page.goto(APP + "/");
  await page.getByText(/İftara \d+ sa \d+ dk|Sahurun bitmesine \d+ sa \d+ dk/).waitFor();
  await shot("35-ramazan");
  await page.goto(APP + "/profile");
  await page.getByRole("switch", { name: "Ramazan modu" }).click();
  await page.getByLabel("İftar saati").waitFor({ state: "detached" });
  ok("Ramazan modu: Sahur/İftar adları ve geri sayım; kapatılınca eski hâline dönüyor");

  // 14. Ana panel toplamları (veritabanıyla karşılaştır)
  await toastGone();
  await page.goto(APP + "/");
  const { data: prof } = await service.from("profiles").select("id, kcal_target, weight_kg").eq("first_name", "Ayşe").order("created_at", { ascending: false }).limit(1).single();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
  const { data: rows } = await service.from("food_entries").select("kcal, meal").eq("user_id", prof.id).eq("entry_date", today);
  const total = Math.round(rows.reduce((s, r) => s + Number(r.kcal), 0));
  assert.equal(Number(prof.weight_kg), 67.2);
  assert.ok(rows.some((r) => r.meal === "drink"), "içecek günlük toplamda olmalı");
  const re = (n) => new RegExp("^" + new Intl.NumberFormat("tr-TR").format(n).replace(".", "\\.") + "(\\s|kcal|$)");
  await page.getByText(re(total)).first().waitFor();
  const remaining = prof.kcal_target - total;
  await page.getByText(re(Math.abs(remaining))).first().waitFor();
  await page.getByText(remaining < 0 ? "kcal fazla" : "kcal kaldı").waitFor();
  await page.getByText(/^67,2/).first().waitFor();
  await page.getByRole("img", { name: /BKNY skoru: \d+ / }).waitFor();
  await page.getByText("Yakılan (saatinizden)").waitFor();
  await page.getByText(/^450/).first().waitFor();
  await page.getByRole("button", { name: "D vitamini alındı olarak işaretle" }).waitFor();
  await page.getByText("3 günlük seri").waitFor();
  await shot("11-ana-sayfa");
  await page.screenshot({ path: path.join(SHOTS, "11b-ana-sayfa-tam.png"), fullPage: true });
  ok(`ana panel: alınan ${total} kcal ve kalan ${remaining} kcal veritabanıyla tutarlı`);

  // 15. İstatistikler + dışa aktarma
  await page.goto(APP + "/stats");
  await page.getByText("Kalori tüketimi").waitFor();
  await page.getByText("Hedeflere uyum").waitFor();
  await page.getByRole("heading", { name: "Vitamin ve mineraller" }).waitFor();
  await page.getByText("Demir", { exact: true }).waitFor();
  await page.getByText("B12 vitamini").waitFor();
  await page.locator(".recharts-bar-rectangle").first().waitFor();
  await shot("12-istatistik");
  for (const [label, ext, magic] of [["PDF", ".pdf", "%PDF"], ["CSV (günlük özet)", ".csv", "﻿Tarih;"], ["CSV (tüm kayıtlar)", ".csv", "﻿Tarih;Saat;"]]) {
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: label, exact: true }).click()]);
    const file = path.join(SHOTS, `_export${ext === ".pdf" ? ".pdf" : label.includes("özet") ? "-ozet.csv" : "-kayitlar.csv"}`);
    await dl.saveAs(file);
    const content = fs.readFileSync(file);
    assert.ok(dl.suggestedFilename().endsWith(ext));
    assert.ok(content.toString("utf8", 0, 20).startsWith(magic), `${label} içeriği beklenmedik`);
    assert.ok(content.length > (ext === ".pdf" ? 20000 : 100));
  }
  assert.ok(fs.readFileSync(path.join(SHOTS, "_export-kayitlar.csv"), "utf8").includes("Haşlanmış yumurta"));
  await page.getByRole("tab", { name: "Yıllık" }).click();
  await page.getByText("Kalori tüketimi (aylık ortalama)").waitFor();
  await page.getByRole("tab", { name: "Günlük" }).click();
  await page.getByText("Öğünlere göre kalori").waitFor();
  ok("istatistikler: grafikler, günlük/haftalık/yıllık görünüm, PDF ve CSV indirme");

  // 16. Asistan
  await page.goto(APP + "/assistant");
  await page.getByRole("button", { name: "Bugün ne kadar kalori aldım?" }).click();
  await page.getByText(`kayıtlarınıza göre ${total} kcal`).waitFor();
  await shot("13-asistan");
  ok("asistan gerçek kayıtlara dayalı yanıt verir");

  // 17. Çevrimdışı kayıt ve eşitleme
  await page.goto(APP + "/water");
  await page.getByText("675 / 2.250 ml").waitFor();
  await ctx.setOffline(true);
  await page.getByRole("button", { name: "250 ml", exact: true }).click();
  await page.getByText("250 ml cihaza kaydedildi").waitFor();
  await page.getByText("1 kayıt bağlantı gelince gönderilecek").waitFor();
  await page.getByText("925 / 2.250 ml").waitFor();
  await shot("14-cevrimdisi");
  const count = async () => (await service.from("water_logs").select("id", { count: "exact", head: true }).eq("user_id", prof.id)).count;
  assert.equal(await count(), 2);
  await ctx.setOffline(false);
  await page.getByText("bağlantı gelince gönderilecek").waitFor({ state: "detached", timeout: 15000 });
  for (let i = 0; i < 20 && (await count()) !== 3; i++) await page.waitForTimeout(250);
  assert.equal(await count(), 3);
  ok("çevrimdışı su kaydı cihazda tutulur, bağlantı gelince sunucuya eşitlenir");

  // 18. Profil: hedef düzenleme, tema, dil
  await page.goto(APP + "/profile");
  await page.getByLabel("Kalori (kcal)").fill("1500");
  await page.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
  await page.getByText("Profil kaydedildi.").waitFor();
  await page.getByRole("tab", { name: "Koyu" }).click();
  assert.ok(await page.evaluate(() => document.documentElement.classList.contains("dark")));
  await page.getByRole("tab", { name: "English" }).click();
  await page.getByRole("heading", { name: "Your data and privacy" }).waitFor();
  await page.goto(APP + "/");
  await page.getByRole("heading", { name: "Hello, Ayşe" }).waitFor();
  await page.getByText(/^1[.,]500/).first().waitFor();
  await shot("15-koyu-ingilizce");
  await page.goto(APP + "/profile");
  await page.getByRole("tab", { name: "Türkçe" }).click();
  await page.getByRole("tab", { name: "Açık" }).click();
  ok("profil: hedef değiştirme, koyu tema, İngilizce");

  // 19. Veri indirme
  await page.getByRole("heading", { name: "Verileriniz ve gizlilik" }).waitFor();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Verilerimi indir" }).click()]);
  const exportFile = path.join(SHOTS, "_verilerim.json");
  await dl.saveAs(exportFile);
  const exported = JSON.parse(fs.readFileSync(exportFile, "utf8"));
  assert.equal(exported.account.email, email);
  assert.ok(exported.food_entries.length >= 8 && exported.water_logs.length === 3 && exported.photos.length === 1);
  ok("verilerimi indir: tüm tablolar ve fotoğraf bağlantıları");

  // 20. Yönetim paneli: normal kullanıcıya kapalı
  await page.goto(APP + "/admin");
  await page.getByText("Bu sayfa için yetkiniz yok").waitFor();
  ok("normal kullanıcı yönetim panelini göremez");

  // 21. Masaüstü görünümü (aynı hesap)
  const desktop = await browser.newContext({ viewport: { width: 1366, height: 850 }, locale: "tr-TR", timezoneId: "Europe/Istanbul" });
  const d = await desktop.newPage();
  d.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(`desktop: ${m.text()}`));
  d.on("pageerror", (e) => errors.push(`desktop pageerror: ${e.message}`));
  await d.goto(APP + "/login");
  await d.getByLabel("E-posta").fill(email);
  await d.getByLabel("Şifre").fill("yanlis-parola");
  await d.getByRole("button", { name: "Giriş yap" }).click();
  await d.getByText("E-posta veya şifre hatalı.").waitFor();
  await d.getByLabel("Şifre").fill(password);
  await d.getByRole("button", { name: "Giriş yap" }).click();
  await d.getByRole("heading", { name: "Merhaba, Ayşe" }).waitFor();
  await d.getByRole("link", { name: "Uyku ve durum" }).waitFor();
  await d.screenshot({ path: path.join(SHOTS, "16-masaustu-ana-sayfa.png") });
  await d.goto(APP + "/stats");
  await d.locator(".recharts-bar-rectangle").first().waitFor();
  await d.screenshot({ path: path.join(SHOTS, "17-masaustu-istatistik.png"), fullPage: true });
  ok("masaüstü: hatalı şifre mesajı, cihazlar arası eşitlenmiş veriler, yan menü");
  await desktop.close();

  // 22. Yönetici
  await service.auth.admin.listUsers().then(async ({ data }) => {
    for (const u of data.users.filter((x) => x.email === "admin@example.com")) await service.auth.admin.deleteUser(u.id);
  });
  await service.auth.admin.createUser({ email: "admin@example.com", password, email_confirm: true });
  const adminCtx = await browser.newContext({ viewport: { width: 1366, height: 850 }, locale: "tr-TR" });
  const a = await adminCtx.newPage();
  a.on("pageerror", (e) => errors.push(`admin pageerror: ${e.message}`));
  a.on("dialog", (x) => x.accept());
  await a.goto(APP + "/login");
  await a.getByLabel("E-posta").fill("admin@example.com");
  await a.getByLabel("Şifre").fill(password);
  await a.getByRole("button", { name: "Giriş yap" }).click();
  await a.waitForURL("**/onboarding");
  await a.goto(APP + "/admin");
  await a.waitForTimeout(500);
  assert.ok(a.url().endsWith("/admin"));
  await a.getByText("Genel kullanım istatistikleri").waitFor();
  await a.screenshot({ path: path.join(SHOTS, "18-yonetim-genel.png"), fullPage: true });
  await a.getByRole("tab", { name: "Kullanıcılar" }).click();
  await a.getByText(email).waitFor();
  assert.equal(await a.getByText("Haşlanmış yumurta").count(), 0);
  await a.getByRole("tab", { name: "Ayarlar" }).click();
  await a.getByRole("button", { name: "Bağlantıyı test et" }).click();
  await a.getByText(/Başarılı · gemini/).waitFor();
  await a.getByLabel("Duyuru metni").fill("Bakım: Pazar 02:00");
  await a.getByRole("button", { name: "Ayarları kaydet" }).click();
  await a.getByText("Ayarlar kaydedildi.").waitFor();
  await a.screenshot({ path: path.join(SHOTS, "19-yonetim-ayarlar.png"), fullPage: true });
  await a.getByRole("tab", { name: "Kullanım" }).click();
  await a.getByText("Son çağrılar").waitFor();
  await a.getByText("analyze_photo").first().waitFor();
  await a.screenshot({ path: path.join(SHOTS, "20-yonetim-kullanim.png"), fullPage: true });
  await a.getByRole("tab", { name: "Hatalar" }).click();
  await a.getByText("Sistem hata kayıtları").waitFor();
  ok("yönetim paneli: istatistik, kullanıcılar, Gemini testi, ayarlar, kullanım/maliyet, hatalar");
  await adminCtx.close();

  // 23. Duyuru kullanıcıya görünür; hesap silme
  await page.goto(APP + "/profile");
  await page.getByText("Bakım: Pazar 02:00").waitFor();
  await page.getByRole("button", { name: "Hesabımı sil", exact: true }).click();
  const del = page.getByRole("button", { name: "Hesabımı kalıcı olarak sil" });
  assert.ok(await del.isDisabled());
  await page.getByLabel("Onaylamak için SİL yazın").fill("SİL");
  await del.click();
  await page.waitForURL("**/login");
  assert.equal((await service.from("food_entries").select("id", { count: "exact", head: true }).eq("user_id", prof.id)).count, 0);
  assert.equal((await service.storage.from("meal-photos").list(prof.id)).data.length, 0);
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.getByText("E-posta veya şifre hatalı.").waitFor();
  ok("hesap silme: kayıtlar ve fotoğraflar kalıcı olarak silindi, yeniden giriş yapılamıyor");

  await service.from("app_settings").delete().neq("key", "");
  await service.auth.admin.listUsers().then(async ({ data }) => {
    for (const u of data.users.filter((x) => x.email === "admin@example.com")) await service.auth.admin.deleteUser(u.id);
  });
  await browser.close();
  if (errors.length) {
    console.log("\nKonsol hataları:\n" + [...new Set(errors)].join("\n"));
    process.exit(1);
  }
  console.log(`\n${step} adım geçti, konsol hatası yok`);
})().catch(async (e) => {
  console.error(`\n✗ ${step + 1}. adımda hata: ${e.message.split("\n").slice(0, 6).join("\n")}`);
  if (errors.length) console.log("Konsol hataları:\n" + [...new Set(errors)].join("\n"));
  process.exit(1);
});
