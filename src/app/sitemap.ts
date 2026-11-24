import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Yalnızca herkese açık sayfalar; giriş gerektiren uygulama sayfaları listelenmez. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-11-24");
  const at = (path: string, priority: number) => ({ url: `${SITE_URL}${path}`, lastModified, changeFrequency: "monthly" as const, priority });
  return [at("/", 1), at("/en", 0.9), at("/register", 0.6), at("/login", 0.4), at("/privacy", 0.3), at("/terms", 0.3)];
}
