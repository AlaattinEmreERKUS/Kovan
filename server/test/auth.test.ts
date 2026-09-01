import { describe, it, expect } from "vitest";
import { hashPassword, newSalt, newSessionToken, hashToken, timingSafeEqual , TUR_ITERASYON, TUR_SAYISI } from "../src/auth";

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

  it("ayni parola ve salt timingSafeEqual ile eslesir", async () => {
    const salt = newSalt();
    const a = await hashPassword("kovan123", salt);
    const b = await hashPassword("kovan123", salt);
    expect(timingSafeEqual(a, b)).toBe(true);
  });

  it("bilinen cevap vektoru: parametreler degisirse kirilir", async () => {
    const salt = "00112233445566778899aabbccddeeff";
    const beklenen = "2f37e75c10bd60fc466e2a812bcb0e1d21dc6e9a65088573ce593c5dbbb9227b";
    expect(await hashPassword("kovan123", salt)).toBe(beklenen);
  });

  it("tur basina iterasyon workerd tavanini asmaz", () => {
    // workerd 100.000 ustunu reddediyor. Bu sinir asilirsa uretimde kayit ve
    // giris tamamen oluyor, lokal testler yesil kaldigi icin fark edilmiyor.
    expect(TUR_ITERASYON).toBeLessThanOrEqual(100_000);
    expect(TUR_SAYISI * TUR_ITERASYON).toBe(600_000);
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
