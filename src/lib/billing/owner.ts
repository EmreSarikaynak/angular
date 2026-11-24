/**
 * Kurucu/sahip hesapları: PREMIUM_EMAILS ortam değişkenindeki (virgülle ayrılmış) e-postalar abonelik olmadan da
 * her zaman Premium sayılır. Karşılaştırma büyük/küçük harf duyarsızdır.
 */
export function parseEmailList(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

export function isListedEmail(email: string | null | undefined, raw: string | undefined | null): boolean {
  if (!email) return false;
  return parseEmailList(raw).includes(email.trim().toLowerCase());
}
