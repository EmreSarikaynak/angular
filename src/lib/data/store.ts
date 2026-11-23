"use client";
import { supabase } from "../supabase/client";

/**
 * Çevrimdışı öncelikli veri katmanı.
 *
 * - Yazma: önce Supabase'e gönderilir; ağ yoksa işlem cihazdaki kuyruğa (outbox) alınır
 *   ve bağlantı geldiğinde sırayla gönderilir. Kimlikler istemcide üretildiği için
 *   yeniden gönderim güvenlidir (upsert, idempotent).
 * - Okuma: önce ağ; başarısız olursa son başarılı sonuç yerel önbellekten okunur ve
 *   kuyruktaki bekleyen işlemler üzerine uygulanır.
 */
export type Table = "food_entries" | "water_logs" | "activities" | "daily_logs" | "body_measurements" | "favorites" | "supplements" | "supplement_logs" | "health_rings" | "fasting_sessions" | "meal_plans" | "user_recipes" | "cycle_logs";

interface Row {
  id: string;
  entry_date?: string;
  [k: string]: unknown;
}

interface OutboxOp {
  opId: string;
  table: Table;
  op: "upsert" | "delete";
  row?: Row;
  id?: string;
  onConflict?: string;
  ts: number;
}

let uid: string | null = null;
const listeners = new Set<() => void>();
let flushing = false;
let lastSyncError: string | null = null;

export function setStoreUser(id: string | null) {
  uid = id;
  emit();
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emit() {
  listeners.forEach((fn) => fn());
}

export function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16));
}

const ls = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Kota dolduysa eski okuma önbelleklerini temizle (kuyruk korunur).
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith("bt:cache:"))
          .forEach((k) => localStorage.removeItem(k));
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* yoksay */
      }
    }
  },
};

const outboxKey = () => `bt:outbox:${uid}`;
const cacheKeyOf = (k: string) => `bt:cache:${uid}:${k}`;

function readOutbox(): OutboxOp[] {
  return uid ? ls.get<OutboxOp[]>(outboxKey(), []) : [];
}
function writeOutbox(ops: OutboxOp[]) {
  if (uid) ls.set(outboxKey(), ops);
}

export function pendingCount(): number {
  return readOutbox().length;
}
export function syncError(): string | null {
  return lastSyncError;
}

function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function isNetworkError(error: { message?: string; code?: string } | null, status?: number): boolean {
  if (!error) return false;
  if (isOffline() || status === 0) return true;
  return !error.code && /fetch|network|load failed|timeout|aborted/i.test(error.message ?? "");
}

export class DataError extends Error {}

async function send(op: OutboxOp): Promise<"ok" | "network" | "rejected"> {
  const db = supabase();
  const res =
    op.op === "upsert"
      ? await db.from(op.table).upsert(op.row!, op.onConflict ? { onConflict: op.onConflict } : undefined)
      : await db.from(op.table).delete().eq("id", op.id!);
  if (!res.error) return "ok";
  if (isNetworkError(res.error, res.status)) return "network";
  lastSyncError = res.error.message;
  return "rejected";
}

/** Kayıt ekle/güncelle. Çevrimdışıyken kuyruğa alınır; `queued: true` döner. */
export async function upsertRow<T extends { id: string }>(table: Table, row: T, onConflict?: string): Promise<{ queued: boolean }> {
  if (!uid) throw new DataError("not_signed_in");
  const full = { ...row, user_id: uid } as unknown as Row;
  const op: OutboxOp = { opId: uuid(), table, op: "upsert", row: full, onConflict, ts: Date.now() };
  // Sıra korunmalı: kuyrukta bekleyen varsa yeni işlem de arkasına eklenir.
  if (isOffline() || readOutbox().length > 0) {
    writeOutbox([...readOutbox(), op]);
    emit();
    void flush();
    return { queued: true };
  }
  const result = await send(op);
  if (result === "network") {
    writeOutbox([...readOutbox(), op]);
    emit();
    return { queued: true };
  }
  if (result === "rejected") throw new DataError(lastSyncError ?? "rejected");
  emit();
  return { queued: false };
}

export async function upsertRows<T extends { id: string }>(table: Table, rows: T[]): Promise<{ queued: boolean }> {
  let queued = false;
  for (const r of rows) queued = (await upsertRow(table, r)).queued || queued;
  return { queued };
}

export async function deleteRow(table: Table, id: string): Promise<{ queued: boolean }> {
  if (!uid) throw new DataError("not_signed_in");
  const op: OutboxOp = { opId: uuid(), table, op: "delete", id, ts: Date.now() };
  if (isOffline() || readOutbox().length > 0) {
    writeOutbox([...readOutbox(), op]);
    emit();
    void flush();
    return { queued: true };
  }
  const result = await send(op);
  if (result === "network") {
    writeOutbox([...readOutbox(), op]);
    emit();
    return { queued: true };
  }
  if (result === "rejected") throw new DataError(lastSyncError ?? "rejected");
  emit();
  return { queued: false };
}

/** Kuyruktaki işlemleri sırayla sunucuya gönderir. */
export async function flush(): Promise<void> {
  if (flushing || !uid || isOffline()) return;
  flushing = true;
  let changed = false;
  try {
    for (;;) {
      const ops = readOutbox();
      if (!ops.length) break;
      const result = await send(ops[0]);
      if (result === "network") break;
      // Sunucunun reddettiği (ör. doğrulama hatası) işlem kuyruğu tıkamasın diye düşürülür.
      writeOutbox(readOutbox().filter((o) => o.opId !== ops[0].opId));
      changed = true;
    }
  } finally {
    flushing = false;
    if (changed) emit();
  }
}

type PageResult = { data: unknown[] | null; error: { message?: string; code?: string } | null; status?: number };

/** Supabase istek başına en çok 1000 satır döndürür; tüm sayfaları sırayla okur. */
async function selectAllPages<T>(page: (from: number, to: number) => PromiseLike<PageResult>, max = 20000) {
  const size = 1000;
  const out: T[] = [];
  for (let offset = 0; offset < max; offset += size) {
    const res = await page(offset, offset + size - 1);
    if (res.error) return { data: out, error: res.error, status: res.status };
    out.push(...((res.data ?? []) as T[]));
    if ((res.data ?? []).length < size) break;
  }
  return { data: out, error: null, status: 200 };
}

function overlay<T extends Row>(table: Table, rows: T[], inRange: (r: Row) => boolean): T[] {
  let out = [...rows];
  for (const op of readOutbox()) {
    if (op.table !== table) continue;
    if (op.op === "delete") out = out.filter((r) => r.id !== op.id);
    else if (op.row) {
      const row = op.row;
      const sameKey = (r: Row) => r.id === row.id || (op.onConflict?.includes("entry_date") ? r.entry_date === row.entry_date : false);
      out = out.filter((r) => !sameKey(r));
      if (inRange(row)) out.push(row as T);
    }
  }
  return out;
}

/** Tarih aralığındaki kayıtlar (iki uç dahil). */
export async function fetchRange<T extends Row>(table: Table, from: string, to: string, orderBy = "entry_date"): Promise<T[]> {
  if (!uid) return [];
  const key = cacheKeyOf(`${table}:${from}:${to}`);
  let rows: T[] | null = null;
  if (!isOffline()) {
    const res = await selectAllPages<T>((a, b) => supabase().from(table).select("*").gte("entry_date", from).lte("entry_date", to).order(orderBy).order("id").range(a, b));
    if (!res.error) {
      rows = res.data;
      const days = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
      if (days <= 45) ls.set(key, rows);
    } else if (!isNetworkError(res.error, res.status)) {
      throw new DataError(res.error.message);
    }
  }
  if (rows === null) rows = ls.get<T[]>(key, []);
  return overlay(table, rows, (r) => !!r.entry_date && r.entry_date >= from && r.entry_date <= to);
}

/** Tablodaki tüm kayıtlar (favoriler, ölçümler). */
export async function fetchAll<T extends Row>(table: Table, orderBy: string, ascending = true): Promise<T[]> {
  if (!uid) return [];
  const key = cacheKeyOf(`${table}:all`);
  let rows: T[] | null = null;
  if (!isOffline()) {
    const res = await selectAllPages<T>((a, b) => supabase().from(table).select("*").order(orderBy, { ascending }).order("id").range(a, b));
    if (!res.error) {
      rows = res.data;
      ls.set(key, rows);
    } else if (!isNetworkError(res.error, res.status)) {
      throw new DataError(res.error.message);
    }
  }
  if (rows === null) rows = ls.get<T[]>(key, []);
  return overlay(table, rows, () => true);
}

/** Çıkışta cihazdaki kişisel verileri temizle. */
export function clearLocalData() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("bt:cache:") || k.startsWith("bt:profile:"))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* yoksay */
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void flush().then(emit));
  window.addEventListener("offline", emit);
}
