// Sahte Web Push servisi (yalnızca test): gelen bildirim isteklerini sayar.
//   node tests/integration/mock-push.mjs <key.pem> <cert.pem>
// Uygulama NODE_EXTRA_CA_CERTS=<cert.pem> ile başlatılmalıdır.
import { createServer } from "node:https";
import { readFileSync } from "node:fs";

const hits = [];
createServer({ key: readFileSync(process.argv[2]), cert: readFileSync(process.argv[3]) }, (req, res) => {
  if (req.url === "/__hits") return res.end(JSON.stringify(hits));
  if (req.url === "/__reset") {
    hits.length = 0;
    return res.end("ok");
  }
  req.resume();
  req.on("end", () => {
    if (req.url.startsWith("/gone")) {
      res.writeHead(410);
      return res.end();
    }
    hits.push({ path: req.url, encoding: req.headers["content-encoding"], hasVapid: /^vapid /.test(req.headers.authorization ?? "") });
    res.writeHead(201);
    res.end();
  });
}).listen(8789, "127.0.0.1", () => console.log("mock push on :8789"));
