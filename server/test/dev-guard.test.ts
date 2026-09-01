import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { reset, stub } from "./helpers";

describe("dev ucu uretimde kapali", () => {
  it("KOVAN_DEV tanimsizken /api/dev/invite acilmaz", async () => {
    await reset([]);
    // Test ortami wrangler.jsonc'u kullanir; oraya KOVAN_DEV yazilmadi.
    expect((env as { KOVAN_DEV?: string }).KOVAN_DEV).toBeUndefined();

    const res = await stub().fetch("https://kovan.test/api/dev/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "SIZINTI" }),
    });
    expect(res.status).toBe(404);

    // Davet gercekten olusmadi: o kodla kayit denemesi 403 vermeli.
    const kayit = await stub().fetch("https://kovan.test/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "SIZINTI", username: "sizan", displayName: "S", password: "kovan123" }),
    });
    expect(kayit.status).toBe(403);
  });
});
