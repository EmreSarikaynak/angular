import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["web-push"],
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // Giriş gerektiren uygulama sayfaları ve paylaşım bağlantıları arama sonuçlarına girmez; yalnızca açık sayfalar indekslenir.
      {
        source: "/((?!(?:tanitim|en|login|register|privacy|_next|icons|fonts|api)(?:/|$)|sw\\.js|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|icon\\.png).*)",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
};

export default nextConfig;
