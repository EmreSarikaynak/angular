import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/components/app-provider";
import { ServiceWorker } from "@/components/service-worker";

export const metadata: Metadata = {
  title: { default: "BKN — Bugün kendin için ne yaptın?", template: "%s · BKN" },
  description: "BKN: Bugün kendin için ne yaptın? Yapay zekâ destekli beslenme, su, takviye, spor ve sağlık takibi.",
  applicationName: "BKN",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "BKN", statusBarStyle: "default" },
  icons: { icon: [{ url: "/icons/icon-192.png", sizes: "192x192" }], apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }] },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f8f7",
};

// Tema, ilk boyamadan önce uygulanır (açık/koyu geçişinde titreme olmaz).
const themeScript = `(function(){try{var t=localStorage.getItem('bt:theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');var l=localStorage.getItem('bt:lang');if(l)document.documentElement.lang=l;if(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform())document.documentElement.classList.add('native');}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full font-sans">
        <AppProvider>{children}</AppProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
