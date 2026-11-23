import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Herkese açık sayfalar taranabilir; API ve paylaşım bağlantıları taranmaz. Giriş gerektiren sayfalar ayrıca noindex başlığı taşır. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/share/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
