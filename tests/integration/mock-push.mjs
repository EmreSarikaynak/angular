// Sahte bildirim servisleri (yalnızca test): Web Push, Google OAuth ve FCM HTTP v1 isteklerini doğrular ve sayar.
//   node tests/integration/mock-push.mjs <key.pem> <cert.pem> [servis-hesabı-genel-anahtarı.pem]
// Uygulama NODE_EXTRA_CA_CERTS=<cert.pem> ile başlatılmalıdır.
import { createServer } from "node:https";
import { createVerify } from "node:crypto";
import { readFileSync } from "node:fs";

const publicKey = process.argv[4] ? readFileSync(process.argv[4], "utf8") : null;
const hits = [];

/** FCM kimlik doğrulaması: imzalı JWT'yi servis hesabının genel anahtarıyla doğrular. */
function verifyAssertion(jwt) {
  const [h, c, sig] = jwt.split(".");
  if (!sig || !publicKey) return false;
  const header = JSON.parse(Buffer.from(h, "base64url").toString());
  const claims = JSON.parse(Buffer.from(c, "base64url").toString());
  const ok = createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, Buffer.from(sig, "base64url"));
  return ok && header.alg === "RS256" && claims.iss === "fcm@test-project.iam.gserviceaccount.com" && /firebase\.messaging/.test(claims.scope) && claims.aud === "https://127.0.0.1:8789/oauth/token" && claims.exp > Date.now() / 1000;
}

createServer({ key: readFileSync(process.argv[2]), cert: readFileSync(process.argv[3]) }, (req, res) => {
  if (req.url === "/__hits") return res.end(JSON.stringify(hits));
  if (req.url === "/__reset") {
    hits.length = 0;
    return res.end("ok");
  }
  let body = "";
  req.on("data", (d) => (body += d));
  req.on("end", () => {
    if (req.url === "/oauth/token") {
      const form = new URLSearchParams(body);
      if (form.get("grant_type") !== "urn:ietf:params:oauth:grant-type:jwt-bearer" || !verifyAssertion(form.get("assertion") ?? "")) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "invalid_grant" }));
      }
      hits.push({ kind: "oauth" });
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ access_token: "mock-access-token", expires_in: 3600, token_type: "Bearer" }));
    }
    if (req.url === "/v1/projects/test-project/messages:send") {
      if (req.headers.authorization !== "Bearer mock-access-token") {
        res.writeHead(401);
        return res.end("unauthorized");
      }
      const m = JSON.parse(body).message;
      if (String(m.token).startsWith("BADTOKEN")) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: { code: 404, status: "NOT_FOUND", details: [{ "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError", errorCode: "UNREGISTERED" }] } }));
      }
      hits.push({ kind: "fcm", token: m.token, title: m.notification?.title, body: m.notification?.body, url: m.data?.url, android: m.android?.notification, apns: !!m.apns?.payload?.aps });
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ name: "projects/test-project/messages/1" }));
    }
    if (req.url.startsWith("/gone")) {
      res.writeHead(410);
      return res.end();
    }
    hits.push({ kind: "webpush", path: req.url, encoding: req.headers["content-encoding"], hasVapid: /^vapid /.test(req.headers.authorization ?? "") });
    res.writeHead(201);
    res.end();
  });
}).listen(8789, "127.0.0.1", () => console.log("mock push on :8789"));
