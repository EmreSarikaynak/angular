/**
 * RevenueCat webhook olaylarını abonelik satırına çeviren saf mantık (ağ ya da veritabanı yok; test edilebilir).
 * Belgeler: https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */
export type SubStatus = "active" | "cancelled" | "billing_issue" | "expired";

export interface RcEvent {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  store?: string;
  expiration_at_ms?: number | null;
  event_timestamp_ms?: number;
}

export interface SubRow {
  user_id: string;
  status: SubStatus;
  product_id: string | null;
  store: string | null;
  period_end: string | null;
  will_renew: boolean;
  updated_at: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Abonelik sürüyor mu? "cancelled" ve "billing_issue" dönem sonuna kadar premium sayılır. */
export function isActive(row: { status: string; period_end: string | null } | null | undefined, now = Date.now()): boolean {
  if (!row) return false;
  if (row.status === "expired") return false;
  if (!row.period_end) return row.status === "active";
  return new Date(row.period_end).getTime() > now;
}

/** Olayı satıra çevirir; ilgisiz ya da kimliği geçersiz olaylar için null döner. */
export function rowFromEvent(e: RcEvent, now = Date.now()): SubRow | null {
  const userId = [e.app_user_id, e.original_app_user_id].find((x) => !!x && UUID.test(x));
  if (!userId || !e.type) return null;
  const end = typeof e.expiration_at_ms === "number" ? new Date(e.expiration_at_ms).toISOString() : null;
  const base = { user_id: userId.toLowerCase(), product_id: e.product_id ?? null, store: e.store ?? null, period_end: end, updated_at: new Date(now).toISOString() };
  switch (e.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "PRODUCT_CHANGE":
    case "UNCANCELLATION":
    case "NON_RENEWING_PURCHASE":
    case "SUBSCRIPTION_EXTENDED":
    case "TEMPORARY_ENTITLEMENT_GRANT":
      return { ...base, status: "active", will_renew: e.type !== "NON_RENEWING_PURCHASE" };
    case "CANCELLATION":
      return { ...base, status: "cancelled", will_renew: false };
    case "BILLING_ISSUE":
      return { ...base, status: "billing_issue", will_renew: true };
    case "EXPIRATION":
      return { ...base, status: "expired", will_renew: false, period_end: end ?? new Date(now).toISOString() };
    default:
      return null;
  }
}
