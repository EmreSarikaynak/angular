import "server-only";
import { createSign } from "node:crypto";
import { logError } from "../supabase/server";

/**
 * Firebase Cloud Messaging (HTTP v1) ile mobil bildirim gönderimi.
 * firebase-admin gibi ağır bir paket yerine yalnızca gereken kısım uygulanır:
 * servis hesabı anahtarıyla JWT imzalanır, OAuth2 erişim belirteci alınır, mesaj REST ile gönderilir.
 *
 * Ortam değişkeni: FIREBASE_SERVICE_ACCOUNT = Firebase konsolundan indirilen servis hesabı JSON'unun tamamı.
 * Test için FCM_BASE_URL ile gönderim adresi değiştirilebilir.
 */
interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

let cached: ServiceAccount | null | undefined;

/**
 * Ortam değişkenindeki servis hesabı metnini okur. Yapıştırma sırasında sık görülen bozulmalara toleranslıdır:
 * çevreleyen tırnaklar, özel anahtarın içindeki gerçek satır sonları ve base64 olarak kodlanmış JSON.
 */
export function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  let text = (raw ?? "").trim();
  if (!text) return null;
  if (!text.startsWith("{") && !text.startsWith('"')) {
    try {
      text = Buffer.from(text, "base64").toString("utf8").trim();
    } catch {
      return null;
    }
  }
  const attempts: string[] = [text];
  // Dize içindeki gerçek satır sonlarını \n kaçışına çevir (JSON'da geçersizdirler).
  let fixed = "";
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (inString && ch === "\n") fixed += "\\n";
    else if (inString && ch === "\r") continue;
    else fixed += ch;
    if (escaped) escaped = false;
    else if (ch === "\\") escaped = inString;
    else if (ch === '"') inString = !inString;
  }
  attempts.push(fixed);
  for (const a of attempts) {
    try {
      let v: unknown = JSON.parse(a);
      if (typeof v === "string") v = JSON.parse(v); // tamamı tırnak içine alınmış JSON
      const acc = v as ServiceAccount;
      if (acc?.project_id && acc.client_email && acc.private_key) {
        // Anahtar, kaçışsız yazılmışsa satır sonları "\\n" olarak kalmış olabilir.
        return { ...acc, private_key: acc.private_key.replace(/\\n/g, "\n") };
      }
    } catch {
      /* sıradaki denemeye geç */
    }
  }
  return null;
}

function account(): ServiceAccount | null {
  if (cached !== undefined) return cached;
  cached = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
  return cached;
}

export function fcmConfigured(): boolean {
  return !!account();
}

const b64url = (v: Buffer | string) => Buffer.from(v).toString("base64url");

let token: { value: string; expiresAt: number } | null = null;

async function accessToken(acc: ServiceAccount): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const uri = acc.token_uri || "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: acc.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: uri, iat: now, exp: now + 3600 };
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify(claims))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(acc.private_key);
  const res = await fetch(uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(signature)}` }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`FCM auth HTTP ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  token = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return token.value;
}

export interface FcmMessage {
  title: string;
  body: string;
  /** Bildirime dokunulunca uygulama içinde açılacak yol (ör. /water). */
  url: string;
  tag?: string;
}

export type FcmResult = "sent" | "unregistered" | "failed";

/** Tek bir cihaza gönderir. Geçersiz/silinmiş belirteç için "unregistered" döner (çağıran belirteci siler). */
export async function sendFcm(deviceToken: string, msg: FcmMessage): Promise<FcmResult> {
  const acc = account();
  if (!acc) return "failed";
  const base = (process.env.FCM_BASE_URL || "https://fcm.googleapis.com").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/v1/projects/${encodeURIComponent(acc.project_id)}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await accessToken(acc)}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: { title: msg.title, body: msg.body },
          data: { url: msg.url },
          android: { priority: "HIGH", ttl: "3600s", notification: { ...(msg.tag ? { tag: msg.tag } : {}), channel_id: "bkn_reminders" } },
          apns: { headers: { "apns-priority": "10", "apns-expiration": String(Math.floor(Date.now() / 1000) + 3600) }, payload: { aps: { sound: "default" } } },
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return "sent";
    if (res.status === 401) token = null;
    const text = await res.text().catch(() => "");
    // Silinmiş uygulama / süresi dolmuş belirteç: yeniden denemenin anlamı yok.
    if (res.status === 404 || /UNREGISTERED|registration-token-not-registered|INVALID_ARGUMENT/.test(text)) return "unregistered";
    // Teşhis için nedeni kaydet (belirteç ya da kullanıcı bilgisi içermez). Örn. iOS için APNs anahtarı yüklenmemişse
    // THIRD_PARTY_AUTH_ERROR döner.
    await logError("push.fcm", `FCM ${res.status}`, { body: text.slice(0, 300) });
    return "failed";
  } catch (e) {
    await logError("push.fcm", (e as Error).message ?? "fcm_error", null);
    return "failed";
  }
}
