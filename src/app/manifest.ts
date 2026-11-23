import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BKNY — Bugün kendin için ne yaptın?",
    short_name: "BKNY — Bugün kendin için ne yaptın?",
    description: "Bugün kendin için ne yaptın? Beslenme, su, takviye, spor ve sağlık takibi.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "tr",
    background_color: "#f6f8f7",
    theme_color: "#1f9d76",
    categories: ["health", "fitness", "food"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Fotoğrafla ekle", url: "/add?mode=photo" },
      { name: "Su ekle", url: "/water" },
      { name: "Takviyelerim", url: "/supplements" },
    ],
  };
}
