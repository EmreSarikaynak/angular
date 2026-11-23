// Diyetisyen paneli: diyetisyen ve danışan iki ayrı tarayıcı oturumunda.
//   node --env-file=.env.local tests/e2e/dietitian.cjs [ekran-görüntüsü-klasörü]
const { chromium, devices } = require("playwright");
const { createClient } = require("@supabase/supabase-js");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const APP = process.env.APP_URL ?? "http://127.0.0.1:3000";
const SHOTS = process.argv[2] || path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });
const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const stamp = Date.now();
const errors = [];
let step = 0;
const ok = (name) => console.log(`  ✓ ${String(++step).padStart(2, "0")} ${name}`);

async function signUp(ctx, first, last, email) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${first}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(`${first}: ${m.text()}`));
  page.on("dialog", (d) => d.accept());
  await page.goto(APP + "/register");
  await page.getByLabel("Ad", { exact: true }).fill(first);
  await page.getByLabel("Soyad").fill(last);
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre").fill("Test-parola-123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Kayıt ol" }).click();
  await page.waitForURL("**/onboarding");
  await page.getByLabel("Doğum tarihi").fill("1990-03-10");
  await page.getByRole("button", { name: "Kadın" }).click();
  await page.getByLabel("Boy (cm)").fill("168");
  await page.getByLabel("Kilo (kg)").fill("70");
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByLabel("Hedef kilo (kg)").fill("64");
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByRole("button", { name: "Başla" }).click();
  await page.getByRole("heading", { name: `Merhaba, ${first}` }).waitFor();
  return page;
}

(async () => {
  const browser = await chromium.launch();
  const dCtx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "tr-TR", timezoneId: "Europe/Istanbul" });
  const cCtx = await browser.newContext({ ...devices["iPhone 13"], locale: "tr-TR", timezoneId: "Europe/Istanbul" });
  const dEmail = `dyt${stamp}@example.com`;
  const cEmail = `dan${stamp}@example.com`;
  const dietitian = await signUp(dCtx, "Elif", "Demir", dEmail);
  const client = await signUp(cCtx, "Zeynep", "Arslan", cEmail);

  // 1. Paneli etkinleştir
  await dietitian.goto(APP + "/dietitian");
  assert.ok(await dietitian.getByRole("button", { name: "Paneli etkinleştir" }).isDisabled());
  await dietitian.getByLabel("Danışanlarınıza görünecek adınız").fill("Dyt. Elif Demir");
  await dietitian.getByLabel("Unvan (isteğe bağlı)").fill("Diyetisyen");
  await dietitian.getByRole("button", { name: "Paneli etkinleştir" }).click();
  await dietitian.getByText("Henüz danışanınız yok").waitFor();
  const code = (await dietitian.locator("p.tracking-\\[0\\.2em\\]").innerText()).trim();
  assert.match(code, /^[A-Z2-9]{8}$/);
  ok("diyetisyen paneli etkinleşti, davet kodu oluştu");

  // 2. Danışan bir öğün ve ölçüm girer, sonra kodla bağlanır
  const { data: prof } = await service.from("profiles").select("id").eq("first_name", "Zeynep").order("created_at", { ascending: false }).limit(1).single();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
  await service.from("food_entries").insert({ user_id: prof.id, entry_date: today, meal: "lunch", name: "Izgara somon ve salata", grams: 300, kcal: 520, protein_g: 38, carbs_g: 12, fat_g: 34 });
  await service.from("daily_logs").insert({ user_id: prof.id, entry_date: today, sleep_hours: 7, mood: 4, note: "danışanın özel günlük notu" });
  await client.goto(APP + "/sharing");
  await client.getByLabel("Diyetisyen kodu").fill(code.toLowerCase());
  assert.ok(await client.getByRole("button", { name: "Bağlan", exact: true }).isDisabled(), "rızasız bağlanılabiliyor");
  await client.getByRole("checkbox").first().check();
  await client.getByRole("button", { name: "Bağlan", exact: true }).click();
  await client.getByText("Diyetisyeninize bağlandınız.").waitFor();
  await client.getByText("Dyt. Elif Demir").waitFor();
  await client.getByText("Henüz not bırakılmadı.").waitFor();
  await client.screenshot({ path: path.join(SHOTS, "40-danisan-baglandi.png") });
  ok("danışan açık rızayla kodla bağlandı");

  // 3. Diyetisyen listede görür, rapora girer
  await dietitian.reload();
  await dietitian.getByText("Zeynep Arslan").waitFor();
  await dietitian.getByText("7 günde 1 gün kayıt", { exact: false }).waitFor();
  await dietitian.screenshot({ path: path.join(SHOTS, "41-diyetisyen-paneli.png") });
  await dietitian.getByRole("link", { name: /Zeynep Arslan/ }).click();
  await dietitian.getByRole("heading", { name: "Zeynep Arslan" }).waitFor();
  await dietitian.getByRole("heading", { name: "Öğün ayrıntıları" }).waitFor();
  await dietitian.getByText("Izgara somon ve salata").first().waitFor();
  await dietitian.getByText("Paylaşılmayan: uyku ve ruh hali", { exact: false }).waitFor();
  const text = await dietitian.locator("main").innerText();
  for (const secret of [cEmail, "danışanın özel günlük notu", "1990"]) assert.ok(!text.includes(secret), `${secret} diyetisyene görünüyor`);
  ok("diyetisyen danışanı listede ve raporda görüyor; e-posta, doğum tarihi ve günlük notu görünmüyor");

  // 4. Notlar
  await dietitian.getByLabel("Yeni not").fill("Öğle öğünleri çok iyi; akşam proteinini biraz artıralım.");
  await dietitian.getByRole("button", { name: "Notu kaydet" }).click();
  await dietitian.getByText("Not kaydedildi.").waitFor();
  await dietitian.getByLabel("Yeni not").fill("ÖZEL: iki hafta sonra kontrol");
  await dietitian.getByRole("switch", { name: "Danışan da görsün" }).click();
  await dietitian.getByText("Yalnızca ben göreyim").waitFor();
  await dietitian.getByRole("button", { name: "Notu kaydet" }).click();
  await dietitian.getByText("Özel not", { exact: false }).first().waitFor();
  await dietitian.screenshot({ path: path.join(SHOTS, "42-danisan-raporu.png"), fullPage: true });
  await client.goto(APP + "/");
  await client.getByText("Dyt. Elif Demir size not bıraktı").waitFor();
  await client.getByText("akşam proteinini biraz artıralım", { exact: false }).waitFor();
  await client.screenshot({ path: path.join(SHOTS, "43-danisan-not-karti.png") });
  await client.goto(APP + "/sharing");
  await client.getByText("akşam proteinini biraz artıralım", { exact: false }).waitFor();
  assert.equal(await client.getByText("ÖZEL", { exact: false }).count(), 0, "özel not danışana görünüyor");
  ok("görünür not danışanın ana sayfasına ve paylaşım ekranına ulaştı; özel not ulaşmadı");

  // 5. Danışan öğün ayrıntılarını kapatır
  await client.getByRole("switch", { name: "Öğün ayrıntıları" }).first().click();
  await client.getByText("Kaydedildi.").waitFor();
  await dietitian.reload();
  await dietitian.getByRole("heading", { name: "Zeynep Arslan" }).waitFor();
  await dietitian.getByText("Paylaşılmayan: öğün ayrıntıları", { exact: false }).waitFor();
  assert.equal(await dietitian.getByRole("heading", { name: "Öğün ayrıntıları" }).count(), 0, "kapatılan öğün ayrıntıları hâlâ görünüyor");
  ok("danışan bir bölümü kapatınca diyetisyenin raporundan kalktı");

  // 6. Danışan paylaşımı bitirir
  await client.getByRole("button", { name: "Paylaşımı bitir" }).click();
  await client.getByText("Paylaşım sonlandırıldı.").waitFor();
  assert.equal(await client.getByText("Dyt. Elif Demir").count(), 0);
  await dietitian.reload();
  await dietitian.getByText("Bu danışana erişiminiz yok").waitFor();
  await dietitian.goto(APP + "/dietitian");
  await dietitian.getByText("Henüz danışanınız yok").waitFor();
  assert.equal((await service.from("dietitian_notes").select("id")).data.length, 0, "notlar silinmedi");
  ok("danışan paylaşımı bitirince diyetisyenin erişimi ve notları kaldırıldı");

  for (const e of [dEmail, cEmail]) {
    const { data } = await service.auth.admin.listUsers();
    for (const u of data.users.filter((x) => x.email === e)) await service.auth.admin.deleteUser(u.id);
  }
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
