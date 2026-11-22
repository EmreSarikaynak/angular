import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Besin Takip",
    short_name: "Besin Takip",
    description: "Yapay zekâ destekli beslenme, kalori, su, spor ve sağlık takibi.",
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
      { name: "Yazarak ekle", url: "/add?mode=text" },
    ],
  };
}
