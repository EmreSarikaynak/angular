import type { Metadata } from "next";
import { Landing, COPY } from "@/components/landing";

export const metadata: Metadata = {
  title: { absolute: "BKNY: AI-assisted nutrition and wellbeing tracker" },
  description: COPY.en.jsonLd.description,
  alternates: { canonical: "/en", languages: { tr: "/tanitim", en: "/en", "x-default": "/tanitim" } },
  openGraph: { type: "website", url: "/en", siteName: "BKNY", locale: "en_US", title: "BKNY: What did you do for yourself today?", description: COPY.en.jsonLd.description, images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "BKNY" }] },
  twitter: { card: "summary", title: "BKNY: What did you do for yourself today?", description: COPY.en.jsonLd.description, images: ["/icons/icon-512.png"] },
};

export default function Page() {
  return <Landing lang="en" />;
}
