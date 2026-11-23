"use client";
import { use, useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { SharedReportView, type Shared } from "@/components/shared-report";
import { formatShort } from "@/lib/dates";
import { translate } from "@/lib/i18n";
import type { Lang } from "@/lib/types";


/** Diyetisyen / koç için salt okunur rapor. Oturum gerektirmez; erişim bağlantıdaki gizli belirteçle sağlanır. */
export default function SharedReportPage({ params }: PageProps<"/share/[token]">) {
  const { token } = use(params);
  const [data, setData] = useState<Shared | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "gone">("loading");

  useEffect(() => {
    fetch(`/api/share/${token}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) return setState("gone");
        setData((await r.json()) as Shared);
        setState("ok");
      })
      .catch(() => setState("gone"));
  }, [token]);

  const lang: Lang = data?.language ?? "tr";
  const t = (s: string, v?: Record<string, string | number>) => translate(lang, s, v);

  if (state === "loading") return <div className="grid min-h-dvh place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" /></div>;
  if (state === "gone" || !data) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-md place-items-center p-6 text-center">
        <div>
          <Logo size={56} className="mx-auto mb-4" />
          <h1 className="text-lg font-bold">Bağlantı geçersiz · Link not valid</h1>
          <p className="mt-2 text-sm text-muted">Bu paylaşım bağlantısının süresi dolmuş ya da sahibi tarafından iptal edilmiş. · This shared link has expired or was revoked by its owner.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <header className="flex items-center gap-3">
        <Logo size={44} />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight">{t("{name} · paylaşılan rapor", { name: data.first_name ?? "BKNY" })}</h1>
          <p className="truncate text-sm text-muted">
            {formatShort(data.from, lang)} – {formatShort(data.to, lang)} · {t("Salt okunur")} · {t("Bitiş")}: {data.expires_at ? new Date(data.expires_at).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR") : ""}
          </p>
        </div>
      </header>

      <SharedReportView data={data} lang={lang} />
      <p className="pb-6 text-center text-xs text-muted">{t("Bu rapor kullanıcının kendi kayıtlarına ve tahminlere dayanır. Kullanıcı bu bağlantıyı dilediği zaman iptal edebilir.")} · BKNY</p>
    </main>
  );
}
