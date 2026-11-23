/** Kullanıcının bir listedeki seçenekleri yeniden sıralaması ve gizlemesi (sürükle-bırak ile "pasife alma"). */
export interface ListPref {
  order: string[];
  hidden: string[];
}
export type UiPrefs = Record<string, ListPref>;

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 100) : []);

/** Depolamadan gelen (güvenilmeyen) değeri temizler. */
export function sanitizePrefs(raw: unknown): UiPrefs {
  const out: UiPrefs = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, v] of Object.entries(raw as Record<string, unknown>).slice(0, 30)) {
    if (!v || typeof v !== "object") continue;
    const o = v as { order?: unknown; hidden?: unknown };
    out[key] = { order: strings(o.order), hidden: strings(o.hidden) };
  }
  return out;
}

/** Öğeleri kullanıcının sırasına dizer; tercihte olmayan (yeni eklenen) öğeler varsayılan sıralarıyla sona eklenir. */
export function orderItems<T extends { id: string }>(items: readonly T[], pref?: ListPref): T[] {
  if (!pref?.order.length) return [...items];
  const byId = new Map(items.map((i) => [i.id, i]));
  const picked = pref.order.flatMap((id) => {
    const it = byId.get(id);
    byId.delete(id);
    return it ? [it] : [];
  });
  return [...picked, ...items.filter((i) => byId.has(i.id))];
}

export const isHidden = (pref: ListPref | undefined, id: string) => !!pref?.hidden.includes(id);

/** Sıralanmış ve gizlenenleri çıkarılmış liste. */
export function visibleItems<T extends { id: string }>(items: readonly T[], pref?: ListPref): T[] {
  return orderItems(items, pref).filter((i) => !isHidden(pref, i.id));
}
