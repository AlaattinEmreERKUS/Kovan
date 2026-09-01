import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { reset, stub } from "./helpers";

const BASE = "https://kovan.test";

async function davetIste(baslik: Record<string, string>, govde: unknown) {
  return stub().fetch(`${BASE}/api/admin/invite`, {
    method: "POST",
    headers: { "content-type": "application/json", ...baslik },
    body: JSON.stringify(govde),
  });
}

async function kayitDene(code: string) {
  return stub().fetch(`${BASE}/api/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, username: "deneme", displayName: "D", password: "kovan123" }),
  });
}

describe("yonetici davet ucu", () => {
  beforeEach(() => reset([]));

  it("ADMIN_KEY tanimsizken hicbir baslik ucu acmaz", async () => {
    expect((env as { ADMIN_KEY?: string }).ADMIN_KEY).toBeUndefined();
    expect((await davetIste({}, { code: "X1" })).status).toBe(403);
    expect((await davetIste({ "x-admin": "" }, { code: "X1" })).status).toBe(403);
    expect((await davetIste({ "x-admin": "tahmin" }, { code: "X1" })).status).toBe(403);
    // Davet gercekten olusmadi.
    expect((await kayitDene("X1")).status).toBe(403);
  });
});
