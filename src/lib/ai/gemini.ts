import "server-only";

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface GeminiCall {
  model: string;
  system: string;
  contents: { role: "user" | "model"; parts: GeminiPart[] }[];
  temperature?: number;
  /** Verilirse yanıt yapılandırılmış JSON olarak istenir. */
  responseSchema?: unknown;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

export interface GeminiResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export class GeminiError extends Error {
  constructor(
    public code: "not_configured" | "timeout" | "upstream" | "blocked" | "empty" | "quota" | "billing",
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

export function geminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

const BASE = () => (process.env.GEMINI_API_BASE_URL || "https://generativelanguage.googleapis.com").replace(/\/$/, "");

async function once(call: GeminiCall): Promise<GeminiResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("not_configured", "GEMINI_API_KEY is not set");

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), call.timeoutMs ?? 45_000);
  let res: Response;
  try {
    res = await fetch(`${BASE()}/v1beta/models/${encodeURIComponent(call.model)}:generateContent`, {
      method: "POST",
      // Anahtar yalnızca sunucuda, başlıkta gönderilir; URL'ye ya da istemciye asla yazılmaz.
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: call.system }] },
        contents: call.contents,
        generationConfig: {
          temperature: call.temperature ?? 0.2,
          maxOutputTokens: call.maxOutputTokens ?? 4096,
          ...(call.responseSchema ? { responseMimeType: "application/json", responseSchema: call.responseSchema } : {}),
        },
      }),
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new GeminiError("timeout", "Gemini request timed out");
    throw new GeminiError("upstream", `Gemini request failed: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // 402: ön ödemeli kredi bitti (yeniden denemek işe yaramaz; kullanıcıya "servis kullanılamıyor" gösterilir).
    const code = res.status === 402 ? "billing" : res.status === 429 ? "quota" : "upstream";
    throw new GeminiError(code, `Gemini HTTP ${res.status}: ${body.slice(0, 500)}`, res.status);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  };
  if (json.promptFeedback?.blockReason) throw new GeminiError("blocked", `Blocked: ${json.promptFeedback.blockReason}`);
  const cand = json.candidates?.[0];
  const text = (cand?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) throw new GeminiError(cand?.finishReason === "SAFETY" ? "blocked" : "empty", `Empty response (${cand?.finishReason ?? "unknown"})`);

  const u = json.usageMetadata ?? {};
  return {
    text,
    inputTokens: u.promptTokenCount ?? 0,
    // Düşünme belirteçleri çıktı fiyatından ücretlendirilir.
    outputTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
    latencyMs: Date.now() - started,
  };
}

/** Geçici hatalarda (429/5xx/zaman aşımı) bir kez yeniden dener. */
export async function generate(call: GeminiCall): Promise<GeminiResult> {
  try {
    return await once(call);
  } catch (e) {
    const err = e as GeminiError;
    const retryable = err.code === "timeout" || err.code === "empty" || (err.code === "upstream" && (!err.status || err.status >= 500));
    if (!retryable) throw e;
    await new Promise((r) => setTimeout(r, 600));
    return once(call);
  }
}

/** Model bazen JSON'u ```json bloğu içinde döndürebilir; güvenli ayrıştır. */
export function parseJsonLoose(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("invalid_json");
  }
}
