// Kaynak koddaki t("...") çağrılarından Türkçe metinleri çıkarır.
// Kullanım: node scripts/i18n-extract.mjs          → en.ts içinde eksik olanları listeler
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export function extractKeys(root = "src") {
  const keys = new Set();
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name) && !p.endsWith("i18n/en.ts")) {
        const src = readFileSync(p, "utf8");
        for (const m of src.matchAll(/(?<![\w.])t\(\s*"((?:[^"\\]|\\.)*)"/g)) keys.add(JSON.parse(`"${m[1]}"`));
      }
    }
  };
  walk(root);
  return [...keys];
}

export function enKeys() {
  const src = readFileSync("src/lib/i18n/en.ts", "utf8");
  const keys = new Set();
  for (const m of src.matchAll(/^\s*"((?:[^"\\]|\\.)*)":/gm)) keys.add(JSON.parse(`"${m[1]}"`));
  return keys;
}

if (process.argv[1]?.endsWith("i18n-extract.mjs")) {
  const en = enKeys();
  const missing = extractKeys().filter((k) => !en.has(k));
  console.log(missing.map((k) => JSON.stringify(k)).join("\n"));
  console.error(`${missing.length} eksik çeviri`);
}
