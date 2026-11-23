import { describe, expect, it } from "vitest";
import { parseServiceAccount } from "@/lib/bkn/fcm";

const KEY = "-----BEGIN PRIVATE KEY-----\nAAAA\nBBBB\n-----END PRIVATE KEY-----\n";
const acc = { type: "service_account", project_id: "p", client_email: "a@p.iam.gserviceaccount.com", private_key: KEY };

describe("FIREBASE_SERVICE_ACCOUNT okuma", () => {
  it("normal JSON dosyasını okur", () => {
    expect(parseServiceAccount(JSON.stringify(acc, null, 2))?.private_key).toBe(KEY);
  });
  it("yapıştırmada özel anahtarın satır sonları gerçek satır sonuna dönmüşse yine okur", () => {
    const broken = JSON.stringify(acc, null, 2).replace(/\\n/g, "\n");
    expect(() => JSON.parse(broken)).toThrow();
    expect(parseServiceAccount(broken)?.private_key).toBe(KEY);
  });
  it("tırnak içine alınmış JSON'u okur", () => {
    expect(parseServiceAccount(JSON.stringify(JSON.stringify(acc)))?.client_email).toBe(acc.client_email);
  });
  it("base64 kodlanmış JSON'u okur", () => {
    expect(parseServiceAccount(Buffer.from(JSON.stringify(acc)).toString("base64"))?.project_id).toBe("p");
  });
  it("eksik alan, boş ve anlamsız metinde null döner", () => {
    expect(parseServiceAccount(JSON.stringify({ project_id: "p" }))).toBeNull();
    expect(parseServiceAccount("")).toBeNull();
    expect(parseServiceAccount(undefined)).toBeNull();
    expect(parseServiceAccount("bu json degil")).toBeNull();
  });
});
