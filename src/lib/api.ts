import { supabase } from "./supabase/client";

export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    public data?: Record<string, unknown>,
  ) {
    super(code);
  }
}

/** Kendi backend'imize kimlik doğrulamalı istek. Mobil (native) istemci de aynı sözleşmeyi kullanabilir. */
export async function api<T = unknown>(path: string, init?: { method?: string; body?: unknown; signal?: AbortSignal; timeoutMs?: number }): Promise<T> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError("unauthorized", 401);
  let res: Response;
  // Sunucu yanıt vermezse arayüzün sonsuza dek beklememesi için istemci tarafı zaman aşımı (sunucu işlevi en çok 60 sn çalışır).
  const timeout = AbortSignal.timeout(init?.timeoutMs ?? 75_000);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  try {
    res = await fetch(path, {
      signal,
      method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
      headers: { Authorization: `Bearer ${token}`, ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch (e) {
    if (init?.signal?.aborted) throw new ApiError("cancelled", 0);
    if ((e as Error).name === "TimeoutError" || (e as Error).name === "AbortError") throw new ApiError("timeout", 0);
    throw new ApiError("offline", 0);
  }
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(String(payload.error ?? "server_error"), res.status, payload);
  return payload as T;
}
