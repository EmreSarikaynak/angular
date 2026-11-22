// Yerel test için sahte Gemini sunucusu (yalnızca uçtan uca testlerde kullanılır).
// GEMINI_API_BASE_URL=http://127.0.0.1:8787 ile uygulama bu sunucuya bağlanır.
// Gerçek API ile aynı uç noktayı ve yanıt zarfını taklit eder; üretimde KULLANILMAZ.
import { createServer } from "node:http";

let calls = 0;
const item = (name, ref_key, grams, kcal, p, c, f, confidence) => ({ name, ref_key, quantity: 1, unit: "porsiyon", grams, kcal, protein_g: p, carbs_g: c, fat_g: f, sugar_g: 1, fiber_g: 1, salt_g: 0.5, alcohol_g: 0, confidence });

function analysis(text, hasImage) {
  if (/FAIL_SCHEMA/.test(text)) return "this is not json";
  if (/activity values from this screenshot/.test(text))
    return JSON.stringify({ is_rings: true, move_kcal: 420, move_goal: 500, exercise_min: 24, exercise_goal: 30, stand_hours: 9, stand_goal: 12, steps: 7350, distance_km: 5.2, date: null });
  if (/Goal: recipes that are/.test(text))
    return JSON.stringify({ recipes: [{ name: "Yoğurtlu tavuklu dürüm", kcal: 410, protein_g: 38, carbs_g: 36, fat_g: 11, minutes: 15, ingredients: ["120 g ızgara tavuk", "1 lavaş", "3 yemek kaşığı yoğurt", "Marul, domates"], steps: "Tavuğu dilimleyin, lavaşa yoğurt sürüp malzemeleri sarın.", why: "Kalan protein açığının büyük kısmını kapatır." }] });
  if (/nutrition facts label/i.test(text))
    return JSON.stringify({ is_food: true, dish_name: "Bisküvi", items: [item("Kakaolu bisküvi", null, 30, 142, 2, 20, 6, 0.95)], overall_confidence: 0.95, needs_clarification: false });
  if (hasImage) {
    const hinted = /trust it over your visual estimate/.test(text);
    return JSON.stringify({
      is_food: true,
      dish_name: "Tavuklu pilav tabağı",
      items: [item("Pirinç pilavı", "rice_pilaf", hinted ? 200 : 180, 300, 5, 55, 7, hinted ? 0.9 : 0.4), item("Izgara tavuk göğsü", "chicken_breast_grilled", 150, 250, 46, 0, 5, 0.85), item("Çoban salata", "shepherd_salad", 120, 66, 1, 5, 5, 0.8), item("Beyaz ekmek", "bread_white", 50, 132, 4, 25, 2, 0.85)],
      overall_confidence: hinted ? 0.88 : 0.55,
      needs_clarification: !hinted,
      clarification_question: hinted ? null : "Pilav yaklaşık kaç kaşık ya da kaç su bardağıydı?",
    });
  }
  if (/asdf qwerty/.test(text)) return JSON.stringify({ is_food: false, dish_name: "", items: [], overall_confidence: 0.9, needs_clarification: false });
  return JSON.stringify({
    is_food: true,
    dish_name: "Kahvaltı",
    items: [item("Haşlanmış yumurta", "egg_boiled", 100, 155, 12.6, 1.1, 10.6, 0.95), item("Beyaz ekmek", "bread_white", 50, 132, 4.5, 24.5, 1.6, 0.9), item("Ev yapımı özel sos", null, 30, 90, 1, 3, 8.2, 0.7)],
    overall_confidence: 0.9,
    needs_clarification: false,
  });
}

createServer((req, res) => {
  if (req.url === "/__calls") return res.end(String(calls));
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    calls++;
    if (req.headers["x-goog-api-key"] !== "test-key-local-mock") {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: { message: "API key not valid" } }));
    }
    const json = JSON.parse(body || "{}");
    const parts = (json.contents ?? []).flatMap((c) => c.parts ?? []);
    const text = parts.map((p) => p.text ?? "").join("\n");
    const hasImage = parts.some((p) => p.inlineData);
    if (/FAIL_500/.test(text)) {
      res.writeHead(500);
      return res.end("boom");
    }
    const structured = !!json.generationConfig?.responseSchema;
    const out = structured ? analysis(text, hasImage) : /USER DATA/.test(text) ? `Bugün kayıtlarınıza göre ${(JSON.parse(text.split("USER DATA (JSON):\n")[1].split("\n")[0]).today_entries ?? []).reduce((s, e) => s + e.kcal, 0)} kcal aldınız.` : "OK";
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: out }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 300 } }));
  });
}).listen(8787, "127.0.0.1", () => console.log("mock gemini on :8787"));
