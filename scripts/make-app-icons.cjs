// Mağaza simgeleri ve açılış ekranı kaynaklarını (resources/) Playwright ile üretir.
//   node scripts/make-app-icons.cjs && npm run cap:assets
const { chromium } = require("playwright");
const path = require("node:path");
const out = path.join(__dirname, "..", "resources");
const G = "#1f9d76";
const mark = (scale, ring = true) => `<g transform="translate(512 512) scale(${scale}) translate(-256 -256)">${ring ? `<circle cx="256" cy="256" r="178" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="30"/><path d="M256 78 a178 178 0 1 1 -169.3 123" fill="none" stroke="#fff" stroke-width="30" stroke-linecap="round"/>` : ""}<text x="256" y="298" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-weight="800" font-size="118" letter-spacing="-2" fill="#fff">BKN</text></g>`;
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
(async () => {
  const b = await chromium.launch();
  const shot = async (name, w, h, body, transparent = false) => {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await p.setContent(`<body style="margin:0;background:${transparent ? "transparent" : "#fff"}">${svg(w, h, body)}</body>`);
    await p.screenshot({ path: path.join(out, name), omitBackground: transparent });
    await p.close();
  };
  // iOS: köşesiz, tam kaplayan 1024 px simge; Android uyarlanabilir simge: ön plan (güvenli alanın içinde) + düz arka plan.
  await shot("icon-only.png", 1024, 1024, `<rect width="1024" height="1024" fill="${G}"/>${mark(1.8)}`);
  await shot("icon-foreground.png", 1024, 1024, mark(1.45), true);
  await shot("icon-background.png", 1024, 1024, `<rect width="1024" height="1024" fill="${G}"/>`);
  for (const [name, bg] of [["splash.png", G], ["splash-dark.png", "#0f1513"]]) {
    await shot(name, 2732, 2732, `<rect width="2732" height="2732" fill="${bg}"/><g transform="translate(1366 1366) scale(1.25) translate(-512 -512)">${mark(1.0, true).replace(/^<g transform="[^"]*">/, "<g>")}</g>`.replace("<g><circle", `<g transform="translate(512 512) scale(2) translate(-256 -256)"><circle`));
  }
  await b.close();
})();
