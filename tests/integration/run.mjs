// Bütünleşme testleri: yerel Supabase + çalışan uygulama + sahte Gemini sunucusu gerekir.
//   npx supabase start && npx supabase db reset
//   node scripts/mock-gemini.mjs &  npm run build && npm start &
//   node --env-file=.env.local tests/integration/run.mjs
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";

const APP = process.env.APP_URL ?? "http://127.0.0.1:3000";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const stamp = Date.now();
let passed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  ✗ ${name}\n      ${e.message}`);
  }
}

async function makeUser(email) {
  const db = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await db.auth.signUp({ email, password: "Test-parola-123", options: { data: { first_name: "Test", last_name: "Kullanıcı" } } });
  assert.ifError(error);
  assert.ok(data.session, "oturum açılmalı");
  return { db, id: data.user.id, token: data.session.access_token, email };
}
const call = async (path, user, body, method) => {
  const res = await fetch(APP + path, { method: method ?? (body ? "POST" : "GET"), headers: { ...(user ? { Authorization: `Bearer ${user.token}` } : {}), "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};
const mockCalls = async () => Number(await (await fetch("http://127.0.0.1:8787/__calls")).text());
const entry = (o = {}) => ({ entry_date: "2026-11-20", meal: "lunch", name: "Mercimek çorbası", kcal: 155, protein_g: 9, carbs_g: 22, fat_g: 3.5, ...o });

await service.auth.admin.listUsers().then(async ({ data }) => {
  for (const u of data.users.filter((x) => x.email === "admin@example.com")) await service.auth.admin.deleteUser(u.id);
});
const A = await makeUser(`a${stamp}@example.com`);
const B = await makeUser(`b${stamp}@example.com`);
const ADMIN = await makeUser("admin@example.com");
const anon = createClient(URL_, ANON, { auth: { persistSession: false } });

console.log("Veritabanı ve RLS");
await test("kayıtta profil satırı otomatik oluşur", async () => {
  const { data } = await A.db.from("profiles").select("*");
  assert.equal(data.length, 1);
  assert.equal(data[0].id, A.id);
  assert.equal(data[0].first_name, "Test");
});
let entryId;
await test("kullanıcı kendi kaydını ekler ve okur", async () => {
  const { data, error } = await A.db.from("food_entries").insert(entry()).select().single();
  assert.ifError(error);
  entryId = data.id;
  assert.equal(data.user_id, A.id);
});
await test("başka kullanıcı kaydı göremez, güncelleyemez, silemez", async () => {
  assert.equal((await B.db.from("food_entries").select("*")).data.length, 0);
  assert.equal((await B.db.from("food_entries").update({ kcal: 1 }).eq("id", entryId).select()).data.length, 0);
  await B.db.from("food_entries").delete().eq("id", entryId);
  assert.equal((await A.db.from("food_entries").select("kcal").eq("id", entryId).single()).data.kcal, 155);
});
await test("başkası adına kayıt eklenemez", async () => {
  const { error } = await B.db.from("food_entries").insert(entry({ user_id: A.id }));
  assert.ok(error, "RLS reddetmeli");
});
await test("kayıt sahibi değiştirilemez", async () => {
  const { error, data } = await A.db.from("food_entries").update({ user_id: B.id }).eq("id", entryId).select();
  assert.ok(error || data.length === 0);
});
await test("başkasının profili okunamaz ve değiştirilemez", async () => {
  assert.equal((await B.db.from("profiles").select("*").eq("id", A.id)).data.length, 0);
  assert.equal((await B.db.from("profiles").update({ first_name: "Hack" }).eq("id", A.id).select()).data.length, 0);
});
await test("oturumsuz erişim hiçbir kullanıcı verisi döndürmez", async () => {
  for (const t of ["profiles", "food_entries", "water_logs", "activities", "daily_logs", "body_measurements", "favorites", "chat_messages", "push_subscriptions"]) {
    const { data, error } = await anon.from(t).select("*").limit(1);
    assert.ok(error || data.length === 0, t);
  }
});
await test("yönetim tabloları ve fonksiyonları kullanıcılara kapalı", async () => {
  await service.from("admins").upsert({ user_id: ADMIN.id });
  await service.from("ai_usage").insert({ user_id: A.id, kind: "seed" });
  for (const t of ["admins", "app_settings", "user_limits", "ai_usage", "ai_cache", "error_logs"]) {
    const { data, error } = await A.db.from(t).select("*").limit(1);
    assert.ok(error || data.length === 0, `${t} okunabildi`);
  }
  assert.ok((await A.db.from("admins").insert({ user_id: A.id })).error, "kendini yönetici yapabildi");
  assert.ok((await A.db.from("user_limits").upsert({ user_id: A.id, daily_ai_limit: 9999 })).error, "kendi limitini değiştirebildi");
  assert.ok((await A.db.rpc("admin_overview")).error, "admin_overview çağrılabildi");
  await service.from("ai_usage").delete().eq("kind", "seed");
});
await test("veri doğrulama kısıtları geçersiz değerleri reddeder", async () => {
  assert.ok((await A.db.from("food_entries").insert(entry({ kcal: -5 }))).error);
  assert.ok((await A.db.from("food_entries").insert(entry({ meal: "brunch" }))).error);
  assert.ok((await A.db.from("water_logs").insert({ entry_date: "2026-11-20", amount_ml: 99999 })).error);
  assert.ok((await A.db.from("daily_logs").insert({ entry_date: "2026-11-20", mood: 9 })).error);
});
await test("günlük durum gün başına tek satır (upsert)", async () => {
  await A.db.from("daily_logs").upsert({ entry_date: "2026-11-20", steps: 4000 }, { onConflict: "user_id,entry_date" });
  await A.db.from("daily_logs").upsert({ entry_date: "2026-11-20", steps: 9000, user_id: A.id }, { onConflict: "user_id,entry_date" });
  const { data } = await A.db.from("daily_logs").select("steps");
  assert.deepEqual(data, [{ steps: 9000 }]);
});

console.log("Depolama");
const photoPath = `${A.id}/test.jpg`;
const jpeg = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");
await test("kullanıcı kendi klasörüne yükler, başkası okuyamaz/yazamaz", async () => {
  assert.ifError((await A.db.storage.from("meal-photos").upload(photoPath, jpeg, { contentType: "image/jpeg" })).error);
  assert.ok((await B.db.storage.from("meal-photos").download(photoPath)).error, "B indirebildi");
  assert.ok((await B.db.storage.from("meal-photos").upload(`${A.id}/b.jpg`, jpeg, { contentType: "image/jpeg" })).error, "B yazabildi");
  assert.ok((await B.db.storage.from("meal-photos").createSignedUrl(photoPath, 60)).error, "B imzalı bağlantı aldı");
  assert.ok((await anon.storage.from("meal-photos").download(photoPath)).error, "anonim indirebildi");
  assert.equal((await fetch(`${URL_}/storage/v1/object/public/meal-photos/${photoPath}`)).ok, false, "herkese açık adres çalıştı");
  assert.ifError((await A.db.storage.from("meal-photos").download(photoPath)).error);
});

console.log("API: kimlik doğrulama ve yönetim");
await test("oturumsuz istekler 401", async () => {
  for (const [p, b] of [["/api/ai/analyze", { kind: "text", text: "x" }], ["/api/ai/assistant", { message: "x", today: "2026-11-20" }], ["/api/config"], ["/api/barcode/8690000000000"], ["/api/admin/overview"], ["/api/account/delete", { scope: "account", confirm: true }]]) {
    assert.equal((await call(p, null, b)).status, 401, p);
  }
  assert.equal((await call("/api/config", { token: "sahte.jwt.degeri" })).status, 401);
});
await test("yönetici olmayan yönetim API'sine erişemez", async () => {
  for (const p of ["overview", "users", "settings", "usage", "errors"]) assert.equal((await call(`/api/admin/${p}`, A)).status, 403, p);
  assert.equal((await call("/api/admin/settings", A, { default_daily_ai_limit: 9999 })).status, 403);
  assert.equal((await call("/api/admin/user-update", A, { user_id: A.id, is_admin: true })).status, 403);
});
await test("yönetici ayarları günceller; geçersiz değer reddedilir", async () => {
  const r = await call("/api/admin/settings", ADMIN, { per_minute_limit: 100, default_daily_ai_limit: 40 });
  assert.equal(r.status, 200);
  assert.equal(r.json.settings.per_minute_limit, 100);
  assert.equal((await call("/api/admin/settings", ADMIN, { gemini_temperature: 5 })).status, 400);
  assert.equal((await call("/api/admin/settings", ADMIN, { gemini_model: "../../etc" })).status, 400);
});
await test("yönetim yanıtları kişisel sağlık verisi içermez", async () => {
  const users = await call("/api/admin/users", ADMIN);
  assert.equal(users.status, 200);
  const text = JSON.stringify([users.json, (await call("/api/admin/overview", ADMIN)).json, (await call("/api/admin/usage", ADMIN)).json]);
  for (const k of ["Mercimek", "weight_kg", "birth_date", "kcal_target", "allergies", "sleep_hours", "photo_path"]) assert.ok(!text.includes(k), `${k} sızdı`);
  assert.ok(users.json.users.find((u) => u.id === A.id));
});
await test("yönetici Gemini bağlantı testi", async () => {
  const r = await call("/api/admin/test-ai", ADMIN, {});
  assert.equal(r.json.ok, true);
});

console.log("API: yapay zekâ");
let firstResult;
await test("metin analizi: doğrulanmış JSON, referans tablosu ve tahmini işareti", async () => {
  const r = await call("/api/ai/analyze", A, { kind: "text", text: `2 haşlanmış yumurta, 2 dilim ekmek ${stamp}`, lang: "tr" });
  assert.equal(r.status, 200);
  firstResult = r.json.result;
  const [egg, bread, sauce] = firstResult.items;
  assert.deepEqual([egg.data_source, egg.kcal, egg.is_estimated], ["reference", 155, false]);
  assert.equal(bread.kcal, 133); // 50 g × 265 kcal/100 g — modelin 132'si değil
  assert.deepEqual([sauce.data_source, sauce.is_estimated], ["ai", true]);
  assert.equal(firstResult.needs_clarification, false);
  assert.equal(r.json.quota.used, 1);
});
await test("aynı istek önbellekten döner, Gemini yeniden çağrılmaz, kotadan düşmez", async () => {
  const before = await mockCalls();
  const r = await call("/api/ai/analyze", A, { kind: "text", text: `2 Haşlanmış  yumurta, 2 dilim ekmek ${stamp}`, lang: "tr" });
  assert.equal(r.json.result.cached, true);
  assert.equal(await mockCalls(), before);
  assert.equal((await call("/api/config", A)).json.quota.used, 1);
});
const img = { data: jpeg.toString("base64").repeat(3) + String(stamp), mimeType: "image/jpeg" };
await test("fotoğraf analizi: ayrı kalemler, düşük güvende porsiyon sorusu", async () => {
  const r = await call("/api/ai/analyze", A, { kind: "photo", image: img, lang: "tr" });
  assert.equal(r.status, 200);
  assert.equal(r.json.result.items.length, 4);
  assert.equal(r.json.result.needs_clarification, true);
  assert.ok(r.json.result.clarification_question.length > 5);
  assert.ok(r.json.result.items.every((i) => i.is_estimated));
});
await test("porsiyon bilgisiyle yeniden analiz güveni yükseltir", async () => {
  const r = await call("/api/ai/analyze", A, { kind: "photo", image: img, hint: "pilav 1 su bardağı", lang: "tr" });
  assert.equal(r.json.result.needs_clarification, false);
  assert.equal(r.json.result.items[0].grams, 200);
  assert.equal(r.json.result.items[0].kcal, 330);
});
await test("etiket analizi etiketteki değerleri korur", async () => {
  const r = await call("/api/ai/analyze", A, { kind: "label", image: { ...img, data: img.data + "L" }, lang: "tr" });
  assert.deepEqual([r.json.result.items[0].data_source, r.json.result.items[0].kcal], ["label", 142]);
});
await test("yiyecek olmayan girdi is_food=false döner", async () => {
  const r = await call("/api/ai/analyze", A, { kind: "text", text: `asdf qwerty ${stamp}`, lang: "tr" });
  assert.equal(r.json.result.is_food, false);
});
await test("geçersiz istekler 400", async () => {
  assert.equal((await call("/api/ai/analyze", A, { kind: "text" })).status, 400);
  assert.equal((await call("/api/ai/analyze", A, { kind: "video", text: "x" })).status, 400);
  assert.equal((await call("/api/ai/analyze", A, { kind: "photo", image: { data: "x", mimeType: "image/jpeg" } })).status, 400);
  assert.equal((await call("/api/ai/assistant", A, { message: "x".repeat(2000), today: "2026-11-20" })).status, 400);
});
await test("şemaya uymayan model yanıtı 502 + hata kaydı", async () => {
  const r = await call("/api/ai/analyze", A, { kind: "text", text: `FAIL_SCHEMA ${stamp}`, lang: "tr" });
  assert.deepEqual([r.status, r.json.error], [502, "invalid_ai_response"]);
  const { data } = await service.from("error_logs").select("source").eq("user_id", A.id);
  assert.ok(data.some((e) => e.source === "ai.analyze"));
});
await test("Gemini 5xx hatası 502 döner (bir kez yeniden denenir)", async () => {
  const before = await mockCalls();
  const r = await call("/api/ai/analyze", A, { kind: "text", text: `FAIL_500 ${stamp}`, lang: "tr" });
  assert.deepEqual([r.status, r.json.error], [502, "ai_error"]);
  assert.equal((await mockCalls()) - before, 2);
});
await test("asistan kullanıcının kendi kayıtlarını kullanır ve sohbeti saklar", async () => {
  const r = await call("/api/ai/assistant", A, { message: "Bugün ne kadar kalori aldım?", today: "2026-11-20", lang: "tr" });
  assert.equal(r.status, 200);
  assert.match(r.json.reply, /155 kcal/);
  const rb = await call("/api/ai/assistant", B, { message: "Bugün ne kadar kalori aldım?", today: "2026-11-20", lang: "tr" });
  assert.match(rb.json.reply, /\b0 kcal/, "B, A'nın verisini görmemeli");
  assert.equal((await A.db.from("chat_messages").select("role").order("created_at")).data.map((m) => m.role).join(), "user,assistant");
});
await test("kullanım ve maliyet kaydı tutulur", async () => {
  const { data } = await service.from("ai_usage").select("kind, cost_usd, cached, status, input_tokens").eq("user_id", A.id);
  const ok = data.find((u) => u.status === "ok" && !u.cached && u.kind === "analyze_text");
  assert.equal(ok.input_tokens, 1200);
  assert.ok(Math.abs(Number(ok.cost_usd) - (1200 * 0.75 + 300 * 3.75) / 1e6) < 1e-9);
  assert.ok(data.some((u) => u.cached) && data.some((u) => u.status === "error"));
});
await test("günlük limit aşılınca 429", async () => {
  assert.equal((await call("/api/admin/user-update", ADMIN, { user_id: B.id, daily_ai_limit: 1 })).status, 200);
  const r = await call("/api/ai/analyze", B, { kind: "text", text: `limit ${stamp}`, lang: "tr" });
  assert.deepEqual([r.status, r.json.error], [429, "daily_limit"]);
  assert.equal((await call("/api/config", B)).json.quota.remaining, 0);
});
await test("dakikalık hız limiti 429", async () => {
  await call("/api/admin/settings", ADMIN, { per_minute_limit: 1 });
  const r = await call("/api/ai/analyze", A, { kind: "text", text: `hız ${stamp}`, lang: "tr" });
  assert.deepEqual([r.status, r.json.error], [429, "rate_limited"]);
  await call("/api/admin/settings", ADMIN, { per_minute_limit: 100 });
});
await test("engellenen kullanıcı YZ kullanamaz", async () => {
  await call("/api/admin/user-update", ADMIN, { user_id: A.id, blocked: true });
  assert.equal((await call("/api/ai/analyze", A, { kind: "text", text: "x", lang: "tr" })).status, 403);
  assert.equal((await call("/api/config", A)).json.ai_available, false);
  await call("/api/admin/user-update", ADMIN, { user_id: A.id, blocked: false });
});
await test("YZ kapatılınca 503", async () => {
  await call("/api/admin/settings", ADMIN, { ai_enabled: false });
  assert.equal((await call("/api/ai/analyze", A, { kind: "text", text: "x", lang: "tr" })).status, 503);
  await call("/api/admin/settings", ADMIN, { ai_enabled: true });
});

console.log("API: diğer");
await test("barkod doğrulaması", async () => {
  assert.equal((await call("/api/barcode/abc", A)).status, 400);
  assert.equal((await call("/api/barcode/123", A)).status, 400);
});
await test("hatırlatma zamanlayıcısı gizli anahtar ister", async () => {
  assert.equal((await fetch(`${APP}/api/cron/reminders`)).status, 401);
  assert.equal((await fetch(`${APP}/api/cron/reminders`, { headers: { Authorization: "Bearer yanlis" } })).status, 401);
  const ok = await fetch(`${APP}/api/cron/reminders`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  assert.equal(ok.status, 200);
});
await test("yönetici kendini silemez / yetkisini kaldıramaz", async () => {
  assert.equal((await call("/api/admin/user-delete", ADMIN, { user_id: ADMIN.id })).status, 400);
  assert.equal((await call("/api/admin/user-update", ADMIN, { user_id: ADMIN.id, is_admin: false })).status, 400);
});
await test("fotoğrafları sil: dosyalar gider, kayıtlar kalır", async () => {
  await A.db.from("food_entries").update({ photo_path: photoPath }).eq("id", entryId);
  const r = await call("/api/account/delete", A, { scope: "photos", confirm: true });
  assert.deepEqual([r.status, r.json.removed], [200, 1]);
  assert.ok((await A.db.storage.from("meal-photos").download(photoPath)).error);
  assert.equal((await A.db.from("food_entries").select("photo_path").eq("id", entryId).single()).data.photo_path, null);
});
await test("hesap silme onaysız reddedilir", async () => {
  assert.equal((await call("/api/account/delete", A, { scope: "account" })).status, 400);
});
await test("hesabı sil: tüm veriler kalıcı olarak silinir", async () => {
  await A.db.storage.from("meal-photos").upload(photoPath, jpeg, { contentType: "image/jpeg" });
  assert.equal((await call("/api/account/delete", A, { scope: "account", confirm: true })).status, 200);
  for (const t of ["profiles", "food_entries", "daily_logs", "chat_messages"]) {
    const col = t === "profiles" ? "id" : "user_id";
    assert.equal((await service.from(t).select("*").eq(col, A.id)).data.length, 0, t);
  }
  assert.equal((await service.storage.from("meal-photos").list(A.id)).data.length, 0);
  assert.equal((await call("/api/config", A)).status, 401, "silinen kullanıcının belirteci geçersiz olmalı");
  const { error } = await anon.auth.signInWithPassword({ email: A.email, password: "Test-parola-123" });
  assert.ok(error);
});


console.log("BKNY: takviyeler, halkalar, tarifler, hatırlatmalar");
const C = await makeUser(`c${stamp}@example.com`);
const D = await makeUser(`d${stamp}@example.com`);
const { createECDH, randomBytes } = await import("node:crypto");
const pushHits = async () => JSON.parse(await (await fetch("https://127.0.0.1:8789/__hits")).text());
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // yalnızca bu test betiğinin sahte push sunucusunu okuması için
const cron = async () => (await fetch(`${APP}/api/cron/reminders`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } })).json();
const local = (d = new Date()) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, time: `${String(Number(p.hour) % 24).padStart(2, "0")}:${p.minute}` };
};
let suppId;
await test("takviye, takviye kaydı ve halkalar yalnızca sahibine açık", async () => {
  const due = local(new Date(Date.now() - 5 * 60_000));
  const { data, error } = await C.db.from("supplements").insert({ name: "D vitamini", dose: "1000 IU", times: [due.time] }).select().single();
  assert.ifError(error);
  suppId = data.id;
  assert.ifError((await C.db.from("health_rings").insert({ entry_date: due.date, move_kcal: 400, move_goal: 500 })).error);
  for (const t of ["supplements", "supplement_logs", "health_rings"]) assert.equal((await D.db.from(t).select("*")).data.length, 0, t);
  assert.ok((await D.db.from("supplement_logs").insert({ supplement_id: suppId, entry_date: due.date, time_slot: due.time, user_id: C.id })).error);
  assert.equal((await D.db.from("supplements").update({ name: "x" }).eq("id", suppId).select()).data.length, 0);
  assert.ok((await C.db.from("supplements").insert({ name: "Saatsiz", times: [] })).error, "saatsiz takviye kabul edildi");
  assert.ok((await C.db.from("health_rings").insert({ entry_date: due.date, move_kcal: 1 })).error, "aynı güne ikinci halka kaydı");
  const nl = await C.db.from("notification_log").select("*").limit(1);
  assert.ok(nl.error || nl.data.length === 0);
  assert.ok((await C.db.from("notification_log").insert({ user_id: C.id, kind: "x", key: "y" })).error);
});
await test("halka ekran görüntüsü okunur; görsel yoksa 400", async () => {
  const r = await call("/api/ai/rings", C, { image: { data: img.data + "R", mimeType: "image/jpeg" } });
  assert.equal(r.status, 200);
  assert.deepEqual([r.json.result.is_rings, r.json.result.move_kcal, r.json.result.exercise_goal, r.json.result.steps, r.json.result.distance_km], [true, 420, 30, 7350, 5.2]);
  assert.equal((await call("/api/ai/rings", C, {})).status, 400);
  assert.equal((await call("/api/ai/rings", null, { image: img })).status, 401);
});
await test("kişisel tarif: doğrulanmış JSON, geçersiz istek 400", async () => {
  const r = await call("/api/ai/recipes", C, { focus: "high_protein", remaining_kcal: 600, remaining_protein_g: 45, lang: "tr" });
  assert.equal(r.status, 200);
  assert.equal(r.json.result.recipes[0].protein_g, 38);
  assert.ok(r.json.result.recipes[0].ingredients.length >= 3);
  assert.equal((await call("/api/ai/recipes", C, { focus: "keto", remaining_kcal: 1, remaining_protein_g: 1 })).status, 400);
  assert.equal((await call("/api/ai/recipes", null, { focus: "low_cal", remaining_kcal: 1, remaining_protein_g: 1 })).status, 401);
});
await test("hatırlatmalar: takviye ve su bildirimi gönderilir, tekrar çağrıda yinelenmez", async () => {
  await fetch("https://127.0.0.1:8789/__reset");
  const now = local();
  const keys = () => { const e = createECDH("prime256v1"); e.generateKeys(); return { p256dh: e.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") }; };
  await C.db.from("push_subscriptions").insert([{ endpoint: `https://127.0.0.1:8789/push/${stamp}`, ...keys() }, { endpoint: `https://127.0.0.1:8789/gone/${stamp}`, ...keys() }]);
  await C.db.from("profiles").update({ water_target_ml: 2000, protein_target_g: 120, kcal_target: 2000, reminder_enabled: true, reminder_start_hour: now.hour, reminder_end_hour: (now.hour + 2) % 24, notify_protein: true, protein_check_hour: now.hour, notify_insights: false, notify_summary: false, supplement_nag_min: 30 }).eq("id", C.id);
  await C.db.from("food_entries").insert(entry({ entry_date: now.date, protein_g: 5 }));
  const first = await cron();
  assert.equal(first.ok, true);
  assert.equal(first.supplement, 1, JSON.stringify(first));
  assert.equal(first.water, 1, JSON.stringify(first));
  assert.equal(first.protein, now.hour >= 11 ? 1 : 0, JSON.stringify(first));
  const hits = await pushHits();
  assert.equal(hits.length, first.supplement + first.water + first.protein);
  assert.ok(hits.every((h) => h.encoding === "aes128gcm" && h.hasVapid), "şifreli ve VAPID imzalı olmalı");
  assert.equal((await C.db.from("push_subscriptions").select("id")).data.length, 1, "geçersiz (410) abonelik silinmeli");
  const second = await cron();
  assert.deepEqual([second.supplement, second.water, second.protein], [0, 0, 0], JSON.stringify(second));
});
await test("hatırlatmalar: alınan takviye ve kapatılan bildirim gönderilmez; D'ye hiçbir şey gitmez", async () => {
  const { data: logs } = await service.from("notification_log").select("user_id, kind");
  assert.ok(logs.length >= 1 && logs.every((l) => l.user_id === C.id));
  await service.from("notification_log").delete().eq("user_id", C.id);
  const now = local();
  const { data: s } = await C.db.from("supplements").select("times").eq("id", suppId).single();
  await C.db.from("supplement_logs").insert({ supplement_id: suppId, entry_date: now.date, time_slot: s.times[0] });
  await C.db.from("profiles").update({ notify_protein: false }).eq("id", C.id);
  const r = await cron();
  assert.deepEqual([r.supplement, r.protein], [0, 0], JSON.stringify(r));
  await C.db.from("supplement_logs").delete().eq("supplement_id", suppId);
  await C.db.from("profiles").update({ notify_supplements: false }).eq("id", C.id);
  assert.equal((await cron()).supplement, 0);
});

console.log("BKNY ekleri: oruç, plan, paylaşım, akşam kapanışı, stok");
await test("oruç, plan ve paylaşım tabloları yalnızca sahibine açık", async () => {
  const now = local();
  assert.ifError((await C.db.from("fasting_sessions").insert({ entry_date: now.date, started_at: new Date(Date.now() - 3600e3).toISOString(), target_hours: 16 })).error);
  assert.ok((await C.db.from("fasting_sessions").insert({ entry_date: now.date, started_at: new Date().toISOString(), ended_at: new Date(Date.now() - 1e6).toISOString() })).error, "bitiş başlangıçtan önce olamaz");
  assert.ifError((await C.db.from("meal_plans").insert({ entry_date: now.date, plan: { days: [], shopping: [] } })).error);
  for (const t of ["fasting_sessions", "meal_plans", "share_links"]) assert.equal((await D.db.from(t).select("*")).data.length, 0, t);
  assert.ok((await C.db.from("food_entries").insert(entry({ caffeine_mg: -1 }))).error);
  assert.ok((await C.db.from("supplements").insert({ name: "x", times: ["09:00"], stock_count: -3 })).error);
});
await test("haftalık öğün planı: 7 gün + alışveriş listesi, profilsiz kullanıcıya 400", async () => {
  const r = await call("/api/ai/meal-plan", C, { lang: "tr", note: "akşamları hafif" });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.result.days.length, 7);
  assert.equal(r.json.result.days[0].meals.length, 4);
  assert.ok(r.json.result.shopping.length >= 3);
  assert.equal((await call("/api/ai/meal-plan", D, { lang: "tr" })).json.error, "profile_incomplete");
  assert.equal((await call("/api/ai/meal-plan", null, {})).status, 401);
});
let shareToken, shareId;
await test("paylaşım bağlantısı: yalnızca seçilen bölümler, kimlik bilgisi sızmaz", async () => {
  const now = local();
  await C.db.from("profiles").update({ first_name: "Cem", last_name: "GizliSoyad", birth_date: "1990-01-01" }).eq("id", C.id);
  await C.db.from("food_entries").insert(entry({ entry_date: now.date, name: "Paylaşılan çorba", note: "çok gizli not" }));
  await C.db.from("daily_logs").upsert({ entry_date: now.date, sleep_hours: 6.5, mood: 4, note: "gizli günlük" }, { onConflict: "user_id,entry_date" });
  await C.db.from("body_measurements").insert({ entry_date: now.date, weight_kg: 71.3 });
  assert.equal((await call("/api/share", null, {})).status, 401);
  assert.equal((await call("/api/share", C, { days: 45, valid_days: 7, include_meals: true, include_body: true, include_wellbeing: false })).status, 400);
  const made = await call("/api/share", C, { label: "Dyt. Elif", days: 30, valid_days: 7, include_meals: true, include_body: false, include_wellbeing: false });
  assert.equal(made.status, 200);
  shareToken = made.json.token;
  shareId = made.json.id;
  assert.ok(shareToken.length >= 40);
  const stored = (await service.from("share_links").select("token_hash").eq("id", shareId).single()).data.token_hash;
  assert.notEqual(stored, shareToken, "belirteç düz metin saklanmamalı");
  const res = await fetch(`${APP}/api/share/${shareToken}`);
  assert.equal(res.status, 200);
  const text = await res.text();
  const data = JSON.parse(text);
  assert.equal(data.first_name, "Cem");
  assert.ok(data.meals.some((m) => m.name === "Paylaşılan çorba"));
  assert.equal(data.weights, null);
  assert.equal(data.profile.weight_kg, undefined);
  assert.equal(data.days[0].sleep_hours, undefined);
  for (const secret of ["GizliSoyad", C.email, "1990-01-01", "gizli", "71.3", C.id, "photo_path"]) assert.ok(!text.includes(secret), `${secret} sızdı`);
  assert.equal((await service.from("share_links").select("view_count").eq("id", shareId).single()).data.view_count, 1);
});
await test("paylaşım: bölüm açılınca gelir; geçersiz, iptal edilmiş ve süresi dolmuş bağlantı 404", async () => {
  const full = await call("/api/share", C, { days: 7, valid_days: 1, include_meals: false, include_body: true, include_wellbeing: true });
  const data = await (await fetch(`${APP}/api/share/${full.json.token}`)).json();
  assert.equal(data.meals, null);
  assert.equal(data.weights[0].weight_kg, 71.3);
  assert.equal(data.days[0].sleep_hours, 6.5);
  assert.equal((await fetch(`${APP}/api/share/${"x".repeat(43)}`)).status, 404);
  assert.equal((await fetch(`${APP}/api/share/kisa`)).status, 404);
  assert.equal((await D.db.from("share_links").update({ revoked_at: null, expires_at: "2099-01-01" }).eq("id", shareId).select()).data.length, 0, "başkası bağlantıyı değiştirebildi");
  await service.from("share_links").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", full.json.id);
  assert.equal((await fetch(`${APP}/api/share/${full.json.token}`)).status, 404, "süresi dolan bağlantı açıldı");
  assert.ifError((await C.db.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("id", shareId)).error);
  assert.equal((await fetch(`${APP}/api/share/${shareToken}`)).status, 404, "iptal edilen bağlantı açıldı");
});
await test("akşam kapanışı ve azalan stok bildirimi bir kez gönderilir", async () => {
  await fetch("https://127.0.0.1:8789/__reset");
  await service.from("notification_log").delete().eq("user_id", C.id);
  const now = local();
  await C.db.from("profiles").update({ reminder_enabled: false, notify_protein: false, notify_supplements: true, notify_evening: true, evening_hour: now.hour }).eq("id", C.id);
  await C.db.from("supplements").update({ active: false }).eq("id", suppId);
  await C.db.from("supplements").insert({ name: "Omega 3", times: ["23:59"], stock_count: 4, per_dose: 1 });
  const first = await cron();
  assert.equal(first.evening, 1, JSON.stringify(first));
  assert.equal(first.stock, now.hour >= 10 && now.hour < 20 ? 1 : 0, JSON.stringify(first));
  const second = await cron();
  assert.deepEqual([second.evening, second.stock], [0, 0], JSON.stringify(second));
  // Stok yenilenince kayıt temizlenir; yeniden azalınca tekrar bildirilir.
  if (first.stock === 1) {
    await C.db.from("supplements").update({ stock_count: 60 }).eq("name", "Omega 3");
    await cron();
    await C.db.from("supplements").update({ stock_count: 2 }).eq("name", "Omega 3");
    assert.equal((await cron()).stock, 1, "yeniden azalan stok bildirilmedi");
  }
  await C.db.from("profiles").update({ notify_evening: false }).eq("id", C.id);
  await service.from("notification_log").delete().eq("user_id", C.id).eq("kind", "evening");
  assert.equal((await cron()).evening, 0, "kapalı akşam bildirimi gönderildi");
});

console.log("BKNY: tarifler, mektup, meydan okuma, döngü, mikro besin, Ramazan, menü");
await test("tarif, döngü ve mektup yalnızca sahibine açık; meydan okuma tabloları tarayıcıya kapalı", async () => {
  const now = local();
  assert.ifError((await C.db.from("user_recipes").insert({ name: "Kuru fasulye", servings: 4, ingredients: [{ name: "Fasulye", kcal: 1200 }] })).error);
  assert.ifError((await C.db.from("cycle_logs").insert({ entry_date: now.date })).error);
  assert.ok((await C.db.from("cycle_logs").insert({ entry_date: "2026-01-01", end_date: "2026-03-01" })).error, "60 günlük adet kabul edildi");
  for (const t of ["user_recipes", "cycle_logs", "weekly_letters"]) assert.equal((await D.db.from(t).select("*")).data.length, 0, t);
  for (const t of ["challenges", "challenge_members"]) {
    const r = await C.db.from(t).select("*").limit(1);
    assert.ok(r.error || r.data.length === 0, `${t} okunabildi`);
  }
  assert.ok((await C.db.from("challenge_members").insert({ challenge_id: C.id, user_id: C.id, display_name: "x", progress: 30 })).error);
});
await test("analiz mikro besinleri döndürür; bozuk değerler ayıklanır ve kayda yazılır", async () => {
  const r = await call("/api/ai/analyze", C, { kind: "text", text: `1 haşlanmış yumurta mikro ${stamp}`, lang: "tr" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.result.items[0].micros, { iron_mg: 1.2, calcium_mg: 50, vitamin_b12_mcg: 1.1, vitamin_d_mcg: 2.2 });
  const now = local();
  const ins = await C.db.from("food_entries").insert(entry({ entry_date: now.date, micros: r.json.result.items[0].micros })).select("micros").single();
  assert.equal(ins.data.micros.iron_mg, 1.2);
});
await test("haftalık mektup: haftada bir üretilir, tekrar istekte kayıtlı olan döner", async () => {
  const now = local();
  assert.equal((await call("/api/ai/weekly-letter", D, { today: now.date, lang: "tr" })).json.error, "no_data");
  assert.equal((await call("/api/ai/weekly-letter", null, { today: now.date })).status, 401);
  const first = await call("/api/ai/weekly-letter", C, { today: now.date, lang: "tr" });
  assert.equal(first.status, 200, JSON.stringify(first.json));
  assert.match(first.json.letter.content, /Merhaba Cem/);
  const before = await mockCalls();
  const second = await call("/api/ai/weekly-letter", C, { today: now.date, lang: "tr" });
  assert.equal(second.json.existing, true);
  assert.equal(second.json.letter.id, first.json.letter.id);
  assert.equal(await mockCalls(), before, "ikinci istekte Gemini çağrıldı");
});
await test("menü rehberi: yemekler uygunluk ve alerjen uyarısıyla", async () => {
  const r = await call("/api/ai/menu", C, { image: { data: img.data + "M", mimeType: "image/jpeg" }, remaining_kcal: 600, remaining_protein_g: 40, lang: "tr" });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.result.dishes.length, 3);
  assert.deepEqual(r.json.result.dishes.map((d) => d.fit), ["ok", "good", "avoid"]);
  assert.equal(r.json.result.dishes[2].allergen_warning, true);
  assert.equal((await call("/api/ai/menu", C, { remaining_kcal: 1 })).status, 400);
  assert.equal((await call("/api/ai/menu", null, {})).status, 400);
});
let chCode, chId;
await test("meydan okuma: oluştur, kodla katıl, yalnızca ad ve gün sayısı paylaşılır", async () => {
  await C.db.from("profiles").update({ ramadan_mode: false }).eq("id", C.id);
  assert.equal((await call("/api/challenges", null)).status, 401);
  assert.equal((await call("/api/challenges", C, { action: "create", title: "x", metric: "sleep", days: 7, display_name: "C" })).status, 400);
  const made = await call("/api/challenges", C, { action: "create", title: "7 gün kayıt", metric: "logging", days: 7, display_name: "Cem" });
  assert.equal(made.status, 200, JSON.stringify(made.json));
  chCode = made.json.challenges[0].join_code;
  chId = made.json.challenges[0].id;
  assert.match(chCode, /^[A-Z2-9]{8}$/);
  assert.deepEqual(made.json.challenges[0].members, [{ name: "Cem", progress: 1, me: true }]);
  assert.equal((await call("/api/challenges", D, { action: "join", code: "ZZZZ2222", display_name: "Deniz" })).status, 404);
  const joined = await call("/api/challenges", D, { action: "join", code: chCode.toLowerCase(), display_name: "Deniz" });
  assert.equal(joined.status, 200, JSON.stringify(joined.json));
  const view = joined.json.challenges[0];
  assert.deepEqual(view.members, [{ name: "Cem", progress: 1, me: false }, { name: "Deniz", progress: 0, me: true }]);
  assert.equal(view.is_owner, false);
  const text = JSON.stringify(joined.json);
  for (const secret of [C.id, C.email, "GizliSoyad", "Paylaşılan çorba", "kcal", "protein_g"]) assert.ok(!text.includes(secret), `${secret} sızdı`);
});
await test("meydan okuma: ilerleme sunucuda kendi kayıtlarından hesaplanır, üye sahte ilerleme yazamaz, ayrılma", async () => {
  await service.from("challenge_members").update({ progress: 7 }).eq("challenge_id", chId).eq("user_id", D.id);
  const list = await call("/api/challenges", D);
  assert.equal(list.json.challenges[0].members.find((m) => m.me).progress, 0, "ilerleme yeniden hesaplanmadı");
  const left = await call("/api/challenges", D, { action: "leave", id: chId });
  assert.equal(left.json.challenges.length, 0);
  assert.equal((await call("/api/challenges", C)).json.challenges[0].members.length, 1);
  await call("/api/challenges", C, { action: "leave", id: chId });
  assert.equal((await service.from("challenges").select("id").eq("id", chId)).data.length, 0, "üyesiz meydan okuma silinmedi");
});
await test("Ramazan modu: su hatırlatması yalnızca iftar–sahur arasında", async () => {
  await fetch("https://127.0.0.1:8789/__reset");
  await service.from("notification_log").delete().eq("user_id", C.id);
  const now = local();
  const hh = (h) => `${String((h + 24) % 24).padStart(2, "0")}:00`;
  await service.from("water_logs").delete().eq("user_id", C.id);
  const base = { reminder_enabled: true, notify_protein: false, notify_supplements: false, notify_evening: false, notify_insights: false, notify_summary: false, ramadan_mode: true, last_reminder_at: null };
  // Şu an oruç saatleri içinde (yeme penceresi 2 saat sonra başlıyor): bildirim yok.
  await service.from("profiles").update({ ...base, iftar_time: hh(now.hour + 2), sahur_time: hh(now.hour + 8) }).eq("id", C.id);
  assert.equal((await cron()).water, 0, "oruç saatinde su bildirimi gitti");
  // Şu an yeme penceresinde: bildirim gider.
  await service.from("profiles").update({ ...base, iftar_time: hh(now.hour - 1), sahur_time: hh(now.hour + 6) }).eq("id", C.id);
  assert.equal((await cron()).water, 1, "yeme penceresinde su bildirimi gitmedi");
});

console.log("BKNY: diyetisyen paneli");
const E = await makeUser(`e${stamp}@example.com`);
await test("diyetisyen tabloları tarayıcıya kapalı; oturumsuz erişim 401", async () => {
  for (const t of ["dietitians", "dietitian_clients", "dietitian_notes"]) {
    const r = await C.db.from(t).select("*").limit(1);
    assert.ok(r.error || r.data.length === 0, `${t} okunabildi`);
  }
  assert.ok((await C.db.from("dietitians").insert({ user_id: C.id, display_name: "Sahte", invite_code: "AAAA2222" })).error);
  assert.equal((await call("/api/dietitian", null)).status, 401);
  assert.equal((await call("/api/dietitian/client/00000000-0000-4000-8000-000000000000", null)).status, 401);
});
let dCode, linkId;
await test("panel etkinleştirme, kodla bağlanma: rıza zorunlu, kendine bağlanılamaz", async () => {
  const en = await call("/api/dietitian", D, { action: "enable", display_name: "Dyt. Deniz Kaya", title: "Diyetisyen" });
  assert.equal(en.status, 200, JSON.stringify(en.json));
  dCode = en.json.dietitian.invite_code;
  assert.match(dCode, /^[A-Z2-9]{8}$/);
  assert.equal((await call("/api/dietitian", D, { action: "enable", display_name: "Dyt. Deniz Kaya" })).json.dietitian.invite_code, dCode, "kod yeniden üretildi");
  const sec = { include_meals: true, include_body: false, include_wellbeing: false };
  assert.equal((await call("/api/dietitian", C, { action: "connect", code: dCode, ...sec })).status, 400, "rızasız bağlandı");
  assert.equal((await call("/api/dietitian", C, { action: "connect", code: dCode, consent: false, ...sec })).status, 400);
  assert.equal((await call("/api/dietitian", C, { action: "connect", code: "ZZZZ9999", consent: true, ...sec })).status, 404);
  assert.equal((await call("/api/dietitian", D, { action: "connect", code: dCode, consent: true, ...sec })).json.error, "cannot_connect_self");
  const ok = await call("/api/dietitian", C, { action: "connect", code: dCode, consent: true, ...sec });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(ok.json.dietitians[0].name, "Dyt. Deniz Kaya");
  linkId = ok.json.dietitians[0].link_id;
  assert.equal((await call("/api/dietitian", C, { action: "connect", code: dCode, consent: true, ...sec })).json.error, "already_connected");
});
await test("diyetisyen yalnızca kendi danışanını ve izin verilen bölümleri görür", async () => {
  const list = await call("/api/dietitian", D);
  assert.equal(list.json.clients.length, 1);
  assert.equal(list.json.clients[0].name, "Cem GizliSoyad");
  assert.ok(list.json.clients[0].logged_days_7 >= 1);
  assert.ok(!JSON.stringify(list.json).includes(C.email), "e-posta sızdı");
  const detail = await call(`/api/dietitian/client/${linkId}?days=7`, D);
  assert.equal(detail.status, 200, JSON.stringify(detail.json));
  assert.ok(detail.json.report.meals.some((m) => m.name === "Paylaşılan çorba"));
  assert.equal(detail.json.report.weights, null, "izin verilmeyen ölçümler geldi");
  assert.equal(detail.json.report.days[0].sleep_hours, undefined);
  const text = JSON.stringify(detail.json);
  for (const secret of [C.email, "1990-01-01", "gizli günlük", "çok gizli not", "photo_path"]) assert.ok(!text.includes(secret), `${secret} sızdı`);
  // Başka bir kullanıcı (E) ne listeyi ne ayrıntıyı görebilir; danışanın kendisi de diyetisyen ucunu kullanamaz.
  assert.equal((await call(`/api/dietitian/client/${linkId}`, E)).status, 404);
  assert.equal((await call(`/api/dietitian/client/${linkId}`, C)).status, 404);
  assert.equal((await call("/api/dietitian", E)).json.clients.length, 0);
});
await test("danışan bölümleri değiştirir; diyetisyen danışanın kapsamını değiştiremez", async () => {
  assert.equal((await call("/api/dietitian", D, { action: "sections", link_id: linkId, include_meals: true, include_body: true, include_wellbeing: true })).status, 404);
  assert.equal((await call(`/api/dietitian/client/${linkId}`, D)).json.report.weights, null);
  assert.equal((await call("/api/dietitian", C, { action: "sections", link_id: linkId, include_meals: false, include_body: true, include_wellbeing: true })).status, 200);
  const detail = await call(`/api/dietitian/client/${linkId}`, D);
  assert.equal(detail.json.report.meals, null);
  assert.equal(detail.json.report.weights[0].weight_kg, 71.3);
  assert.equal(detail.json.report.days.find((d) => d.sleep_hours != null).sleep_hours, 6.5);
});
await test("notlar: görünür not danışana ulaşır, özel not ulaşmaz; yalnızca yazan siler", async () => {
  assert.equal((await call("/api/dietitian", E, { action: "note", link_id: linkId, content: "yetkisiz", visible_to_client: true })).status, 404);
  assert.equal((await call("/api/dietitian", C, { action: "note", link_id: linkId, content: "danışan yazamaz", visible_to_client: true })).status, 404);
  assert.equal((await call("/api/dietitian", D, { action: "note", link_id: linkId, content: "Akşamları proteini artıralım.", visible_to_client: true })).status, 200);
  assert.equal((await call("/api/dietitian", D, { action: "note", link_id: linkId, content: "ÖZEL: kontrol 2 hafta sonra", visible_to_client: false })).status, 200);
  const mine = await call("/api/dietitian", C);
  assert.deepEqual(mine.json.dietitians[0].notes.map((n) => n.content), ["Akşamları proteini artıralım."]);
  assert.ok(!JSON.stringify(mine.json).includes("ÖZEL"));
  const detail = await call(`/api/dietitian/client/${linkId}`, D);
  assert.equal(detail.json.notes.length, 2);
  const priv = detail.json.notes.find((n) => !n.visible_to_client);
  assert.equal((await call("/api/dietitian", C, { action: "note-delete", id: priv.id })).status, 404);
  assert.equal((await call("/api/dietitian", D, { action: "note-delete", id: priv.id })).status, 200);
});
await test("danışan paylaşımı bitirince erişim kesilir ve notlar silinir; yeniden bağlanabilir", async () => {
  assert.equal((await call("/api/dietitian", E, { action: "end", link_id: linkId })).status, 404);
  assert.equal((await call("/api/dietitian", C, { action: "end", link_id: linkId })).status, 200);
  assert.equal((await call(`/api/dietitian/client/${linkId}`, D)).status, 404, "bitirilen bağlantı hâlâ açık");
  assert.equal((await call("/api/dietitian", D)).json.clients.length, 0);
  assert.equal((await service.from("dietitian_notes").select("id").eq("link_id", linkId)).data.length, 0, "notlar silinmedi");
  assert.equal((await call("/api/dietitian", D, { action: "note", link_id: linkId, content: "x", visible_to_client: true })).status, 404);
  const again = await call("/api/dietitian", C, { action: "connect", code: dCode, consent: true, include_meals: true, include_body: true, include_wellbeing: false });
  assert.equal(again.status, 200);
  // Diyetisyen de bağlantıyı sonlandırabilir.
  assert.equal((await call("/api/dietitian", D, { action: "end", link_id: again.json.dietitians[0].link_id })).status, 200);
  assert.equal((await call("/api/dietitian", C)).json.dietitians.length, 0);
});
await service.auth.admin.deleteUser(E.id);

console.log("Mobil uygulama bildirimleri (FCM)");
const GOOD = `GOODTOKEN-${stamp}-abcdefghijklmnop`;
const GOOD2 = `GOODTOKEN2-${stamp}-abcdefghijklmnop`;
const BAD = `BADTOKEN-${stamp}-abcdefghijklmnopq`;
const tokensOf = async (uid) => (await service.from("device_tokens").select("token, platform").eq("user_id", uid)).data;
await test("cihaz belirteci: oturum ister, doğrulanır, hesaplar arası devredilir, yalnızca sahibi siler", async () => {
  assert.equal((await call("/api/devices", null, { token: GOOD, platform: "android" })).status, 401);
  assert.equal((await call("/api/devices", C, { token: "kisa", platform: "android" })).status, 400);
  assert.equal((await call("/api/devices", C, { token: GOOD, platform: "windows" })).status, 400);
  assert.equal((await call("/api/devices", C, { token: GOOD, platform: "android" })).status, 200);
  assert.equal((await call("/api/devices", C, { token: GOOD, platform: "android" })).status, 200);
  assert.deepEqual(await tokensOf(C.id), [{ token: GOOD, platform: "android" }], "aynı belirteç iki kez kaydedildi");
  // Aynı cihaz başka hesapla giriş yaptı: belirteç yeni hesaba geçer, eskisinden kalkar.
  assert.equal((await call("/api/devices", D, { token: GOOD, platform: "android" })).status, 200);
  assert.deepEqual([(await tokensOf(C.id)).length, (await tokensOf(D.id)).length], [0, 1]);
  assert.equal((await call("/api/devices", C, { token: GOOD }, "DELETE")).status, 200, "başkasının belirtecini silme isteği hata vermemeli");
  assert.equal((await tokensOf(D.id)).length, 1, "başkasının belirteci silindi");
  assert.equal((await call("/api/devices", D, { token: GOOD }, "DELETE")).status, 200);
  assert.equal((await tokensOf(D.id)).length, 0);
  const direct = await C.db.from("device_tokens").select("*").limit(1);
  assert.ok(direct.error || direct.data.length === 0, "belirteç tablosu tarayıcıdan okunabildi");
  assert.equal((await call("/api/config", C)).json.fcm_available, true);
});
await test("cihaz sayısı kullanıcı başına 10 ile sınırlı", async () => {
  for (let i = 0; i < 12; i++) await call("/api/devices", D, { token: `LIMITTOKEN-${stamp}-${String(i).padStart(2, "0")}-abcdefghij`, platform: "ios" });
  assert.equal((await tokensOf(D.id)).length, 10);
  await service.from("device_tokens").delete().eq("user_id", D.id);
});
await test("hatırlatma FCM ile gider: JWT imzası doğrulanır, geçersiz belirteç silinir, iki cihaza ulaşır", async () => {
  await fetch("https://127.0.0.1:8789/__reset");
  await service.from("notification_log").delete().eq("user_id", C.id);
  await service.from("water_logs").delete().eq("user_id", C.id);
  const now = local();
  await service.from("push_subscriptions").delete().eq("user_id", C.id);
  await service.from("profiles").update({ reminder_enabled: true, reminder_start_hour: now.hour, reminder_end_hour: (now.hour + 2) % 24, notify_protein: false, notify_supplements: false, notify_evening: false, notify_insights: false, notify_summary: false, ramadan_mode: false, last_reminder_at: null, water_target_ml: 2000, language: "tr" }).eq("id", C.id);
  for (const [t, p] of [[GOOD, "android"], [GOOD2, "ios"], [BAD, "android"]]) assert.equal((await call("/api/devices", C, { token: t, platform: p })).status, 200);
  const r = await cron();
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.water, 1, JSON.stringify(r));
  const hits = await pushHits();
  assert.equal(hits.filter((h) => h.kind === "oauth").length, 1, "erişim belirteci bir kez alınmalı (önbellek)");
  const sent = hits.filter((h) => h.kind === "fcm");
  assert.deepEqual(sent.map((h) => h.token).sort(), [GOOD, GOOD2].sort());
  for (const h of sent) {
    assert.match(h.title, /💧/);
    assert.match(h.body, /ml/);
    assert.equal(h.url, "/water");
    assert.equal(h.android.channel_id, "bkn_reminders_v2");
    assert.equal(h.apns, true);
  }
  assert.deepEqual((await tokensOf(C.id)).map((t) => t.token).sort(), [GOOD, GOOD2].sort(), "geçersiz (UNREGISTERED) belirteç silinmeli");
  // Aynı çağrı tekrarlanınca (su aralığı dolmadığı için) yeniden gönderilmez.
  await fetch("https://127.0.0.1:8789/__reset");
  assert.equal((await cron()).water, 0);
  assert.equal((await pushHits()).filter((h) => h.kind === "fcm").length, 0);
});
await test("cihazı olmayan kullanıcıya FCM bildirimi sayılmaz; başkasının cihazına gitmez", async () => {
  await service.from("device_tokens").delete().eq("user_id", C.id);
  await call("/api/devices", D, { token: GOOD, platform: "android" });
  await fetch("https://127.0.0.1:8789/__reset");
  await service.from("profiles").update({ last_reminder_at: null }).eq("id", C.id);
  const r = await cron();
  assert.equal(r.water, 0, "cihazı olmayan kullanıcıya bildirim sayıldı");
  assert.equal((await pushHits()).filter((h) => h.kind === "fcm").length, 0);
  await service.from("device_tokens").delete().eq("user_id", D.id);
});
await service.auth.admin.deleteUser(C.id);
await service.auth.admin.deleteUser(D.id);
await service.auth.admin.deleteUser(B.id);
await service.auth.admin.deleteUser(ADMIN.id);
await service.from("app_settings").delete().neq("key", "");
console.log(`\n${passed} geçti, ${failures.length} başarısız`);
if (failures.length) process.exit(1);
