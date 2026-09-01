import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("worker", () => {
  it("saglik ucu 200 ve ok doner", async () => {
    const res = await SELF.fetch("https://kovan.test/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("bilinmeyen yol 404 doner", async () => {
    const res = await SELF.fetch("https://kovan.test/yok");
    expect(res.status).toBe(404);
  });
});
