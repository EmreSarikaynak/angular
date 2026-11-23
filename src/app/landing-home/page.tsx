import type { Metadata } from "next";
import { Landing, COPY } from "@/components/landing";
import { AuthRedirect } from "@/components/auth-redirect";

// "/" adresi, oturumu olmayanlara proxy ile bu sayfayı gösterir (bkz. src/proxy.ts); standart adres "/" olarak bildirilir.
export const metadata: Metadata = {
  title: { absolute: "BKNY: Yapay zekâ destekli beslenme ve sağlık takibi" },
  description: COPY.tr.jsonLd.description,
  alternates: { canonical: "/", languages: { tr: "/", en: "/en", "x-default": "/" } },
  openGraph: { type: "website", url: "/", siteName: "BKNY", locale: "tr_TR", title: "BKNY: Bugün kendin için ne yaptın?", description: COPY.tr.jsonLd.description, images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "BKNY" }] },
  twitter: { card: "summary", title: "BKNY: Bugün kendin için ne yaptın?", description: COPY.tr.jsonLd.description, images: ["/icons/icon-512.png"] },
};

export default function Page() {
  return (
    <>
      <AuthRedirect />
      <Landing lang="tr" path="/" />
    </>
  );
}
