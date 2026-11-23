// Mağaza ekran görüntüleri için SAHTE Supabase arka ucu (yalnızca yerel geliştirme/gösterim verisi).
// Kullanım: node store/screenshots/fake-backend.mjs  (PORT ortam değişkeni, varsayılan 54399)
import http from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT || 54399);
const EN = process.env.FAKE_LANG === "en";
const t = (tr, en) => (EN ? en : tr);
const USER_ID = "00000000-0000-4000-8000-000000000001";
const NOW = new Date();
const key = (d) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul" }).format(d);
const TODAY = key(NOW);
const day = (n) => key(new Date(NOW.getTime() - n * 86_400_000));
const at = (date, hhmm) => `${date}T${hhmm}:00+03:00`;
const uid = () => randomUUID();

const base = { sugar_g: 0, fiber_g: 0, salt_g: 0, alcohol_g: 0 };
let n = 0;
const food = (date, meal, time, name, kcal, p, c, f, extra = {}) => ({
  id: uid(), user_id: USER_ID, entry_date: date, consumed_at: at(date, time), meal, name, quantity: 1, unit: "porsiyon", grams: null,
  kcal, protein_g: p, carbs_g: c, fat_g: f, ...base, source: "photo", data_source: "ai", is_estimated: true, confidence: 0.86, photo_path: null,
  group_id: null, group_name: null, drink_type: null, volume_ml: null, abv: null, micros: null, note: null, created_at: at(date, time), ...extra,
});

const profile = {
  id: USER_ID, first_name: "Elif", last_name: "Yılmaz", birth_date: "1994-05-12", sex: "female", height_cm: 168, start_weight_kg: 68, weight_kg: 64.6, target_weight_kg: 60,
  activity_level: "moderate", goal: "lose", weekly_rate_kg: 0.4, allergies: [], diet_preferences: [], kcal_target: 1750, protein_target_g: 90, carbs_target_g: 200, fat_target_g: 54,
  water_target_ml: 2100, steps_target: 8000, targets_custom: false, add_exercise_calories: false, store_photos: false, language: EN ? "en" : "tr", theme: "light", timezone: "Europe/Istanbul",
  reminder_enabled: true, reminder_interval_min: 120, reminder_start_hour: 9, reminder_end_hour: 21, reminder_start_minute: 0, reminder_end_minute: 0, notify_supplements: true, supplement_nag_min: 30,
  notify_protein: true, protein_check_hour: 18, protein_check_minute: 0, notify_insights: true, notify_summary: true, notify_evening: true, evening_hour: 21, evening_minute: 0,
  fasting_target_hours: 16, ramadan_mode: false, iftar_time: "19:00", sahur_time: "04:30", ramadan_answered: null, ui_prefs: {}, onboarded_at: at(day(20), "09:00"), created_at: at(day(20), "09:00"),
};

const T = {
  profiles: [profile],
  food_entries: [],
  water_logs: [],
  activities: [],
  daily_logs: [],
  body_measurements: [],
  favorites: [],
  supplements: [],
  supplement_logs: [],
  health_rings: [],
  fasting_sessions: [],
  meal_plans: [],
  user_recipes: [],
  cycle_logs: [],
  pantry_items: [],
  chat_messages: [],
  weekly_letters: [],
};

// Bugün
T.food_entries.push(
  food(TODAY, "breakfast", "08:10", t("Menemen, 1 dilim tam buğday ekmeği", "Menemen (eggs with tomatoes), 1 slice whole-wheat bread"), 345, 19, 24, 19, { sugar_g: 4, fiber_g: 4, salt_g: 1.4 }),
  food(TODAY, "breakfast", "08:12", t("Beyaz peynir, domates, salatalık", "Feta cheese, tomato, cucumber"), 130, 8, 5, 8, { fiber_g: 1.5, salt_g: 1.2 }),
  food(TODAY, "lunch", "13:05", t("Izgara tavuk, bulgur pilavı, çoban salata", "Grilled chicken, bulgur pilaf, shepherd salad"), 560, 42, 55, 17, { sugar_g: 5, fiber_g: 8, salt_g: 1.8 }),
  food(TODAY, "snack", "16:20", t("Yoğurt ve yaban mersini", "Yogurt with blueberries"), 150, 10, 18, 4, { sugar_g: 14, fiber_g: 2, source: "text" }),
);
// Önceki günler (grafikler için)
const dailyKcal = [1680, 1790, 1720, 1650, 1830, 1700, 1760, 1690, 1810, 1740, 1670, 1780, 1730];
for (let i = 1; i <= 13; i++) {
  const d = day(i);
  const k = dailyKcal[i - 1];
  T.food_entries.push(
    food(d, "breakfast", "08:00", t("Yulaf, süt ve muz", "Oats, milk and banana"), Math.round(k * 0.25), 15, 55, 9),
    food(d, "lunch", "13:00", t("Mercimek çorbası, tavuklu salata", "Lentil soup, chicken salad"), Math.round(k * 0.35), 38 + (i % 4) * 3, 48, 16),
    food(d, "dinner", "19:30", t("Fırın somon ve sebze", "Baked salmon with vegetables"), Math.round(k * 0.3), 34, 28, 20),
    food(d, "snack", "16:00", t("Meyve ve badem", "Fruit and almonds"), Math.round(k * 0.1), 5, 20, 8),
  );
}
const water = (date, time, ml) => ({ id: uid(), user_id: USER_ID, entry_date: date, logged_at: at(date, time), amount_ml: ml });
for (const [t, ml] of [["08:00", 250], ["10:30", 330], ["12:45", 250], ["15:10", 200], ["16:40", 220]]) T.water_logs.push(water(TODAY, t, ml));
for (let i = 1; i <= 13; i++) for (const [t, ml] of [["09:00", 500], ["13:00", 500], ["17:00", 500], ["20:00", 400 + (i % 3) * 150]]) T.water_logs.push(water(day(i), t, ml));
const act = (date, time, type, name, min, km, intensity, met, kcal) => ({ id: uid(), user_id: USER_ID, entry_date: date, started_at: at(date, time), type, name, duration_min: min, distance_km: km, intensity, met, kcal_burned: kcal, note: null });
T.activities.push(act(TODAY, "07:20", "walking", t("Sabah yürüyüşü", "Morning walk"), 35, 3.2, "moderate", 3.5, 110));
for (let i = 1; i <= 13; i += 2) T.activities.push(act(day(i), "18:00", i % 4 === 1 ? "running" : "walking", null, 30 + (i % 3) * 10, 3.5, "moderate", 7, 230));
const steps = [6210, 8120, 9340, 7480, 10250, 5900, 8800, 7600, 9100, 8350, 7020, 9900, 8600];
T.daily_logs.push({ id: uid(), user_id: USER_ID, entry_date: TODAY, steps: 5230, sleep_hours: 7.5, sleep_quality: 4, mood: 4, energy: 4, stress: 2, note: null });
for (let i = 1; i <= 13; i++) T.daily_logs.push({ id: uid(), user_id: USER_ID, entry_date: day(i), steps: steps[i - 1], sleep_hours: 6.4 + (i % 5) * 0.4, sleep_quality: 3 + (i % 3 === 0 ? 1 : 0), mood: 3 + (i % 2), energy: 3 + (i % 2), stress: 2 + (i % 3 === 0 ? 1 : 0), note: null });
const weights = [68, 67.8, 67.5, 67.1, 66.9, 66.4, 66.2, 65.8, 65.5, 65.2, 64.9, 64.7, 64.6];
weights.forEach((w, i) => T.body_measurements.push({ id: uid(), user_id: USER_ID, entry_date: day(12 - i), weight_kg: w, waist_cm: 78 - i * 0.2, hip_cm: null, chest_cm: null, body_fat_pct: null, bmi: Math.round((w / (1.68 * 1.68)) * 10) / 10, note: null }));
const sup = (name, dose, times, stock, per = 1) => ({ id: uid(), user_id: USER_ID, name, dose, times, active: true, note: null, stock_count: stock, per_dose: per, created_at: at(day(15), "10:00") });
const D = sup(t("D vitamini", "Vitamin D"), t("1 damla, 1000 IU", "1 drop, 1000 IU"), ["08:00"], 42), O = sup("Omega-3", t("1 kapsül", "1 capsule"), ["13:00"], 9), M = sup(t("Magnezyum", "Magnesium"), t("1 tablet, 200 mg", "1 tablet, 200 mg"), ["21:30"], 24);
T.supplements.push(D, O, M);
T.supplement_logs.push({ id: uid(), user_id: USER_ID, supplement_id: D.id, entry_date: TODAY, time_slot: "08:00", taken_at: at(TODAY, "08:14") });
for (let i = 1; i <= 6; i++) T.supplement_logs.push({ id: uid(), user_id: USER_ID, supplement_id: D.id, entry_date: day(i), time_slot: "08:00", taken_at: at(day(i), "08:10") });
const pan = (name, location, added, shelf, category = "food", extra = {}) => ({ id: uid(), user_id: USER_ID, name, location, added_on: day(added), expires_on: null, shelf_days: shelf, expiry_source: "estimate", category, volume_ml: null, abv: null, kcal: null, created_at: at(day(added), "12:00"), ...extra });
T.pantry_items.push(
  pan(t("Tavuk göğsü", "Chicken breast"), "freezer", 30, 120),
  pan(t("Süt", "Milk"), "fridge", 3, 6, "drink", { kcal: 122, volume_ml: 250 }),
  pan(t("Ispanak", "Spinach"), "fridge", 3, 4),
  pan(t("Yumurta", "Eggs"), "fridge", 5, 21),
  pan(t("Beyaz peynir", "Feta cheese"), "fridge", 6, 28, "food", { expires_on: day(-3), shelf_days: null, expiry_source: "label" }),
  pan(t("Yoğurt", "Yogurt"), "fridge", 2, 8),
  pan(t("Dondurulmuş bezelye", "Frozen peas"), "freezer", 40, 240),
  pan(t("Makarna", "Pasta"), "pantry", 20, 365),
  pan("Omega-3", "pantry", 10, 365, "supplement"),
);
const chat = (role, content, min) => ({ id: uid(), user_id: USER_ID, role, content, created_at: new Date(NOW.getTime() - min * 60_000).toISOString() });
T.chat_messages.push(
  chat("user", t("Bugün proteinim nasıl gidiyor?", "How is my protein going today?"), 14),
  chat("assistant", t("Bugün şimdiye kadar yaklaşık 79 g protein aldın; hedefin 90 g. Akşam yemeğinde bir porsiyon balık ya da 2 yumurta eklersen hedefi rahatça tamamlarsın. Su tarafında 1250 ml'desin, hedefin 2100 ml.", "So far today you have had about 79 g of protein; your goal is 90 g. A portion of fish or 2 eggs at dinner will comfortably close the gap. You are at 1250 ml of water against a 2100 ml goal."), 13),
  chat("user", t("Akşam için hafif bir fikir var mı?", "Any light idea for dinner?"), 4),
  chat("assistant", t("Fırında somon, yanında buharda brokoli ve bir kaşık yoğurtlu sos iyi olur: yaklaşık 420 kcal ve 34 g protein. İstersen tarifini de yazayım.", "Oven-baked salmon with steamed broccoli and a spoon of yogurt sauce works well: about 420 kcal and 34 g protein. Want the recipe?"), 3),
);

// --- PostgREST benzeri basit sunucu ---------------------------------------------------------
const num = (v) => (typeof v === "string" && v !== "" && !isNaN(Number(v)) ? Number(v) : v);
function applyFilters(rows, params) {
  let out = rows;
  for (const [k, v] of params) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue;
    const m = /^(eq|gte|lte|gt|lt|in|neq|is)\.(.*)$/.exec(v);
    if (!m) continue;
    const [, op, val] = m;
    out = out.filter((r) => {
      const a = r[k];
      if (op === "eq") return String(a) === val;
      if (op === "neq") return String(a) !== val;
      if (op === "is") return val === "null" ? a == null : a != null;
      if (op === "in") return val.replace(/[()]/g, "").split(",").includes(String(a));
      if (a == null) return false;
      const x = num(a), y = num(val);
      return op === "gte" ? x >= y : op === "lte" ? x <= y : op === "gt" ? x > y : x < y;
    });
  }
  const order = params.get("order");
  if (order) {
    const [col, dir] = order.split(".");
    out = [...out].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === "desc" ? -1 : 1));
  }
  const lim = Number(params.get("limit"));
  return lim ? out.slice(0, lim) : out;
}
const user = { id: USER_ID, aud: "authenticated", role: "authenticated", email: "elif@example.com", email_confirmed_at: at(day(20), "09:00"), app_metadata: { provider: "email" }, user_metadata: {}, created_at: at(day(20), "09:00") };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const send = (code, body, headers = {}) => {
    res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": req.headers.origin || "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*", "Access-Control-Expose-Headers": "Content-Range", ...headers });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };
  if (req.method === "OPTIONS") return send(204);
  let raw = "";
  for await (const c of req) raw += c;
  if (url.pathname === "/auth/v1/user") return send(200, user);
  if (url.pathname === "/auth/v1/token") return send(200, { access_token: "fake.access.token", token_type: "bearer", expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, refresh_token: "fake-refresh", user });
  if (url.pathname.startsWith("/auth/v1/")) return send(200, {});
  if (url.pathname.startsWith("/storage/v1/")) return send(404, { error: "not_found" });
  const m = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname);
  if (m) {
    const table = m[1];
    const rows = T[table] ?? [];
    if (req.method === "GET" || req.method === "HEAD") {
      const out = applyFilters(rows, url.searchParams);
      const wantsObject = (req.headers.accept || "").includes("vnd.pgrst.object");
      const range = { "Content-Range": `0-${Math.max(0, out.length - 1)}/${out.length}` };
      if (req.method === "HEAD") return send(200, undefined, range);
      if (wantsObject) return out.length ? send(200, out[0]) : send(406, { code: "PGRST116", message: "no rows", details: "", hint: null });
      return send(200, out, range);
    }
    // Yazma işlemleri: gösterim için kabul et, kalıcı yapma.
    let body = null;
    try { body = JSON.parse(raw); } catch {}
    const echo = Array.isArray(body) ? body : body ? [body] : [];
    if ((req.headers.prefer || "").includes("return=representation") || req.method === "PATCH") {
      const wantsObject = (req.headers.accept || "").includes("vnd.pgrst.object");
      if (table === "profiles" && req.method === "PATCH") Object.assign(T.profiles[0], body);
      return send(200, wantsObject ? (table === "profiles" ? T.profiles[0] : echo[0] ?? {}) : table === "profiles" ? T.profiles : echo);
    }
    return send(201, undefined);
  }
  if (url.pathname.startsWith("/rest/v1/rpc/")) return send(200, null);
  console.log("[fake-backend] bilinmeyen istek:", req.method, url.pathname);
  return send(404, { message: "not found" });
});
server.listen(PORT, "127.0.0.1", () => console.log(`fake backend http://127.0.0.1:${PORT} (bugün ${TODAY})`));
