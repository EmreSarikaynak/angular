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

await service.auth.admin.deleteUser(B.id);
await service.auth.admin.deleteUser(ADMIN.id);
await service.from("app_settings").delete().neq("key", "");
console.log(`\n${passed} geçti, ${failures.length} başarısız`);
if (failures.length) process.exit(1);
