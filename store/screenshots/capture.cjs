// Mağaza ekran görüntülerini üretir. Önkoşul: sahte arka uç (fake-backend.mjs) ve uygulama (next start) çalışıyor.
//   FAKE_LANG=en node store/screenshots/fake-backend.mjs &   # İngilizce demo veri için
//   LANG_CODE=tr|en BASE=http://localhost:3100 node store/screenshots/capture.cjs
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const lang = process.env.LANG_CODE === "en" ? "en" : "tr";
const base = process.env.BASE || "http://localhost:3100";
const outRoot = path.join(__dirname, lang);
const { screens } = JSON.parse(fs.readFileSync(path.join(__dirname, "captions.json"), "utf8"));
const SIZES = { ios: [1290, 2796], android: [1080, 1920] };
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const STATUS = `<div id="bt-status" style="position:fixed;top:0;left:0;right:0;height:50px;z-index:99999;display:flex;align-items:center;justify-content:space-between;padding:6px 30px 0;font:600 16px -apple-system,system-ui,Inter,sans-serif;color:#111;background:var(--bg,#f6f8f7)">
  <span>9:41</span>
  <span style="display:flex;gap:6px;align-items:center">
    <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="#111"/><rect x="5" y="5" width="3" height="7" rx="1" fill="#111"/><rect x="10" y="2.5" width="3" height="9.5" rx="1" fill="#111"/><rect x="15" y="0" width="3" height="12" rx="1" fill="#111"/></svg>
    <svg width="17" height="12" viewBox="0 0 17 12"><path d="M8.5 2.4c2.3 0 4.4.9 6 2.4l1-1.1A9.7 9.7 0 0 0 8.5.8 9.7 9.7 0 0 0 1.5 3.7l1 1.1a8.2 8.2 0 0 1 6-2.4zm0 3.3c1.4 0 2.6.5 3.6 1.4l1-1.1a7 7 0 0 0-9.2 0l1 1.1c1-.9 2.2-1.4 3.6-1.4zm0 3.2c.6 0 1.2.2 1.6.7L8.5 11.5 6.9 9.600c.4-.5 1-.7 1.6-.7z" fill="#111"/></svg>
    <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="#111" opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2" fill="#111"/><rect x="24.5" y="4" width="2" height="5" rx="1" fill="#111" opacity=".4"/></svg>
  </span></div>
  <div id="bt-home" style="position:fixed;bottom:7px;left:50%;transform:translateX(-50%);width:140px;height:5px;border-radius:3px;background:#111;opacity:.85;z-index:99999"></div>`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, locale: lang === "en" ? "en-US" : "tr-TR", timezoneId: "Europe/Istanbul" });
  await ctx.addInitScript((l) => {
    const user = { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: "elif@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
    localStorage.setItem("sb-127-auth-token", JSON.stringify({ access_token: "fake.access.token", token_type: "bearer", expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, refresh_token: "fake-refresh", user }));
    localStorage.setItem("bt:lang", l);
    localStorage.setItem("bt:theme", "light");
  }, lang);
  const page = await ctx.newPage();
  const shots = [];
  for (const s of screens) {
    await page.goto(base + s.path, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1800);
    await page.addStyleTag({ content: "html{padding-top:50px}" });
    await page.evaluate((html) => document.body.insertAdjacentHTML("beforeend", html), STATUS);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const buf = await page.screenshot();
    shots.push({ s, data: "data:image/png;base64," + buf.toString("base64") });
    await page.evaluate(() => { document.getElementById("bt-status")?.remove(); document.getElementById("bt-home")?.remove(); });
    console.log("captured", s.id);
  }
  // Başlıklı kompozisyon (iOS 6,7" ve Android telefon boyutları)
  for (const [platform, [W, H]] of Object.entries(SIZES)) {
    const dir = path.join(outRoot, platform);
    fs.mkdirSync(dir, { recursive: true });
    const comp = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    let i = 0;
    for (const { s, data } of shots) {
      i++;
      const [title, sub] = s[lang];
      const phoneW = Math.round(W * 0.84);
      const phoneH = Math.round((phoneW * 932) / 430);
      const topPad = Math.round(H * 0.045);
      const titleSize = Math.round(W * 0.066);
      const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;width:${W}px;height:${H}px;overflow:hidden;background:linear-gradient(165deg,#22b185 0%,#1f9d76 45%,#0d6a50 100%);font-family:Inter,'Inter Display',system-ui,sans-serif;position:relative">
        <div style="position:absolute;left:${Math.round(W * 0.08)}px;right:${Math.round(W * 0.08)}px;top:${topPad}px;color:#fff;text-align:center">
          <div style="font-weight:800;font-size:${titleSize}px;line-height:1.12;letter-spacing:-0.02em;text-wrap:balance">${esc(title)}</div>
          <div style="margin-top:${Math.round(titleSize * 0.35)}px;font-weight:500;font-size:${Math.round(titleSize * 0.46)}px;opacity:.92;text-wrap:balance">${esc(sub)}</div>
        </div>
        <div style="position:absolute;left:${Math.round((W - phoneW) / 2)}px;top:${Math.round(H * 0.215)}px;width:${phoneW}px;height:${phoneH}px;border-radius:${Math.round(W * 0.055)}px;overflow:hidden;box-shadow:0 0 0 ${Math.round(W * 0.009)}px #0b0f0d, 0 ${Math.round(W * 0.03)}px ${Math.round(W * 0.07)}px rgba(0,0,0,.35)">
          <img src="${data}" style="width:100%;display:block">
        </div></body>`;
      await comp.setContent(html);
      await comp.waitForTimeout(250);
      await comp.screenshot({ path: path.join(dir, `${String(i).padStart(2, "0")}-${s.id}.png`) });
    }
    await comp.close();
  }
  // Google Play öne çıkan görsel (1024×500)
  {
    const home = shots[0].data;
    const tagline = lang === "en" ? "What did you do for yourself today?" : "Bugün kendin için ne yaptın?";
    const sub = lang === "en" ? "AI-assisted nutrition & wellbeing tracker" : "Yapay zekâ destekli beslenme ve sağlık takibi";
    const icon = "data:image/png;base64," + fs.readFileSync(path.join(__dirname, "..", "..", "public", "icons", "icon-512.png")).toString("base64");
    const fg = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
    await fg.setContent(`<!doctype html><meta charset="utf-8"><body style="margin:0;width:1024px;height:500px;overflow:hidden;background:linear-gradient(120deg,#22b185,#1f9d76 50%,#0d6a50);font-family:Inter,system-ui,sans-serif;position:relative;color:#fff">
      <div style="position:absolute;left:64px;top:96px;width:520px"><img src="${icon}" style="width:96px;height:96px;border-radius:22px;box-shadow:0 6px 18px rgba(0,0,0,.25)">
        <div style="font-weight:800;font-size:68px;letter-spacing:-.02em;margin-top:18px">BKNY</div>
        <div style="font-weight:700;font-size:31px;line-height:1.2;margin-top:6px;text-wrap:balance">${esc(tagline)}</div>
        <div style="font-weight:500;font-size:21px;opacity:.9;margin-top:12px">${esc(sub)}</div></div>
      <div style="position:absolute;left:660px;top:46px;width:300px;height:650px;border-radius:40px;overflow:hidden;transform:rotate(-6deg);box-shadow:0 0 0 7px #0b0f0d,0 24px 50px rgba(0,0,0,.4)"><img src="${home}" style="width:100%;display:block"></div></body>`);
    await fg.waitForTimeout(250);
    fs.mkdirSync(path.join(outRoot, "android"), { recursive: true });
    await fg.screenshot({ path: path.join(outRoot, "android", "feature-graphic-1024x500.png") });
    await fg.close();
  }
  await browser.close();
  console.log("done ->", outRoot);
})();
