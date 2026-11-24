"use client";
import { useApp } from "./app-provider";

/** Kurucu hesaba gösterilen sıcak sözler (cinsiyetten bağımsız). Gün gün değişir, dokununca bir sonrakine geçer. */
export function useOwnerMessages(): string[] {
  const { t } = useApp();
  return [
    t("Sen bu uygulamanın kalbisin."),
    t("Emeğin her ekranda, her satırda saklı. İyi ki varsın."),
    t("Bir fikir, bir emek ve binlerce daha sağlıklı gün. Teşekkürler."),
    t("Bugün kendin için de bir şey yap; en çok sen hak ediyorsun."),
    t("Küçük adımlar, büyük hayaller. Sen ikisini de yaptın."),
    t("Senin ışığın bu uygulamada parlıyor."),
    t("Yorulduysan bir bardak su, derin bir nefes; sonra devam."),
    t("İyi ki bu işe cesaret ettin. Seninle gurur duyuyoruz."),
    t("Sen güldükçe BKNY de güzelleşiyor."),
    t("Her güne yeniden başlamak bir güzellik; bugün de senin."),
    t("Kendine iyi bakmayı hatırlatan bir uygulama kurdun; şimdi sıra sende."),
    t("Hayal ettiğin şey bugün birilerinin hayatını güzelleştiriyor."),
  ];
}

export function dayOfYear(d = new Date()): number {
  return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000);
}
