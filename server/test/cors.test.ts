import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("CORS", () => {
  it("preflight 204 ve izin basliklariyla doner", async () => {
    const res = await SELF.fetch("https://kovan.test/api/login", {
      method: "OPTIONS",
      headers: { origin: "http://127.0.0.1:5173", "access-control-request-method": "POST" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-headers")).toContain("content-type");
  });

  it("api yaniti CORS basligi tasir", async () => {
    const res = await SELF.fetch("https://kovan.test/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "yok", password: "yanlis" }),
    });
    expect(res.status).toBe(401);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});
