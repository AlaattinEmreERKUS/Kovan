import { describe, it, expect, vi } from "vitest";
import { gorunumOku, gorunumYaz, VARSAYILAN_GORUNUM, type DepoBenzeri } from "./gorunum";

function sahteDepo(baslangic: Record<string, string> = {}): DepoBenzeri & { veri: Record<string, string> } {
  const veri = { ...baslangic };
  return {
    veri,
    getItem: (k: string) => veri[k] ?? null,
    setItem: (k: string, v: string) => { veri[k] = v; },
  };
}

describe("gorunumOku", () => {
  it("kayit yoksa varsayilana duser", () => {
    expect(gorunumOku(sahteDepo())).toBe(VARSAYILAN_GORUNUM);
    expect(VARSAYILAN_GORUNUM).toBe("herkes");
  });

  it("kayitli gecerli degeri okur", () => {
    expect(gorunumOku(sahteDepo({ kovan_gorunum: "video" }))).toBe("video");
  });

  it("bozuk deger varsayilana duser", () => {
    expect(gorunumOku(sahteDepo({ kovan_gorunum: "sacma" }))).toBe("herkes");
  });

  it("depo yoksa varsayilana duser", () => {
    expect(gorunumOku(null)).toBe("herkes");
  });

  it("depo patlarsa varsayilana duser", () => {
    // Gizli sekmede localStorage erisimi istisna firlatabilir.
    const patlayan: DepoBenzeri = {
      getItem: () => { throw new Error("SecurityError"); },
      setItem: () => {},
    };
    expect(gorunumOku(patlayan)).toBe("herkes");
  });
});

describe("gorunumYaz", () => {
  it("degeri depoya yazar", () => {
    const depo = sahteDepo();
    gorunumYaz("video", depo);
    expect(depo.veri.kovan_gorunum).toBe("video");
  });

  it("depo patlarsa sessizce yutar", () => {
    const patlayan: DepoBenzeri = {
      getItem: () => null,
      setItem: () => { throw new Error("QuotaExceededError"); },
    };
    expect(() => gorunumYaz("video", patlayan)).not.toThrow();
  });

  it("depo yoksa patlamaz", () => {
    expect(() => gorunumYaz("video", null)).not.toThrow();
  });
});
