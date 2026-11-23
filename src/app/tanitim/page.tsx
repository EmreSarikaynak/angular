import type { Metadata } from "next";
import { Landing, COPY } from "@/components/landing";

export const metadata: Metadata = {
  title: { absolute: "BKNY: Yapay zekâ destekli beslenme ve sağlık takibi" },
  description: COPY.tr.jsonLd.description,
  alternates: { canonical: "/tanitim", languages: { tr: "/tanitim", en: "/en", "x-default": "/tanitim" } },
  openGraph: { type: "website", url: "/tanitim", siteName: "BKNY", locale: "tr_TR", title: "BKNY: Bugün kendin için ne yaptın?", description: COPY.tr.jsonLd.description, images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "BKNY" }] },
  twitter: { card: "summary", title: "BKNY: Bugün kendin için ne yaptın?", description: COPY.tr.jsonLd.description, images: ["/icons/icon-512.png"] },
};

export default function Page() {
  return <Landing lang="tr" />;
}
