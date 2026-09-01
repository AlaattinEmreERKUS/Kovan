import { describe, it, expect } from "vitest";
import { hashPassword, newSalt, newSessionToken, hashToken, timingSafeEqual } from "../src/auth";

describe("auth", () => {
  it("ayni parola ve salt ayni hash uretir", async () => {
    const salt = newSalt();
    const a = await hashPassword("kovan123", salt);
    const b = await hashPassword("kovan123", salt);
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("farkli salt farkli hash uretir", async () => {
    const a = await hashPassword("kovan123", newSalt());
    const b = await hashPassword("kovan123", newSalt());
    expect(a).not.toBe(b);
  });

  it("yanlis parola eslesmez", async () => {
    const salt = newSalt();
    const dogru = await hashPassword("kovan123", salt);
    const yanlis = await hashPassword("kovan124", salt);
    expect(timingSafeEqual(dogru, yanlis)).toBe(false);
  });

  it("session token 64 hex ve her cagrida farkli", () => {
    const a = newSessionToken();
    const b = newSessionToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  it("token hash deterministik", async () => {
    const t = newSessionToken();
    expect(await hashToken(t)).toBe(await hashToken(t));
  });
});
