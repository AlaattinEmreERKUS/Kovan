import { describe, it, expect } from "vitest";
import {
  KISAYOL_VARSAYILAN, kisayollariOku, kisayollariYaz, type Kisayollar,
} from "./kisayollar";

function sahteDepo(baslangic: string | null = null) {
  let deger = baslangic;
  return {
    getItem: () => deger,
    setItem: (_a: string, d: string) => { deger = d; },
  };
}

describe("kisayollar", () => {
  it("kayit yoksa varsayilanlar doner", () => {
    expect(kisayollariOku(sahteDepo())).toEqual(KISAYOL_VARSAYILAN);
  });

  it("varsayilanlar F8, F9, F10", () => {
    expect(KISAYOL_VARSAYILAN).toEqual({ ptt: "F8", mik: "F9", kulaklik: "F10" });
  });

  it("kayitli kisayollar okunur", () => {
    const d = sahteDepo(JSON.stringify({ ptt: "CmdOrCtrl+Shift+K", mik: "F9", kulaklik: "F10" }));
    expect(kisayollariOku(d).ptt).toBe("CmdOrCtrl+Shift+K");
  });

  it("eksik alan varsayilanla tamamlanir", () => {
    const d = sahteDepo(JSON.stringify({ ptt: "F7" }));
    expect(kisayollariOku(d)).toEqual({ ...KISAYOL_VARSAYILAN, ptt: "F7" });
  });

  it("bos ya da metin olmayan deger varsayilana duser", () => {
    const d = sahteDepo(JSON.stringify({ ptt: "", mik: 5, kulaklik: "  " }));
    expect(kisayollariOku(d)).toEqual(KISAYOL_VARSAYILAN);
  });

  it("bozuk JSON uygulamayi durdurmaz", () => {
    expect(kisayollariOku(sahteDepo("{bozuk"))).toEqual(KISAYOL_VARSAYILAN);
  });

  it("yazilan deger geri okunur", () => {
    const d = sahteDepo();
    const k: Kisayollar = { ptt: "F6", mik: "F9", kulaklik: "F10" };
    kisayollariYaz(k, d);
    expect(kisayollariOku(d)).toEqual(k);
  });
});
