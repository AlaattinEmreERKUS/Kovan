import { describe, it, expect } from "vitest";
import {
  CIHAZ_SECIMI_VARSAYILAN, cihazSecimiOku, cihazSecimiYaz,
} from "./ses-cihazlari";
import type { DepoBenzeri } from "./ses-ayarlari";

function sahteDepo(baslangic: Record<string, string> = {}): DepoBenzeri {
  const veri = { ...baslangic };
  return {
    getItem: (k) => (k in veri ? veri[k] : null),
    setItem: (k, v) => { veri[k] = v; },
  };
}

describe("cihaz secimi kaliciligi", () => {
  it("kayit yoksa varsayilana duser", () => {
    expect(cihazSecimiOku(sahteDepo())).toEqual(CIHAZ_SECIMI_VARSAYILAN);
  });

  it("yazilan secim geri okunur", () => {
    const depo = sahteDepo();
    cihazSecimiYaz({ giris: "mik-1", cikis: "kulaklik-1" }, depo);
    expect(cihazSecimiOku(depo)).toEqual({ giris: "mik-1", cikis: "kulaklik-1" });
  });

  it("bozuk JSON uygulamayi durdurmaz", () => {
    const depo = sahteDepo({ kovan_ses_cihazlari: "{bozuk" });
    expect(cihazSecimiOku(depo)).toEqual(CIHAZ_SECIMI_VARSAYILAN);
  });

  /** Elle bozulmus ya da eski kayit: taninmayan tip null'a duser. */
  it("metin olmayan deger null olur", () => {
    const depo = sahteDepo({ kovan_ses_cihazlari: '{"giris":42,"cikis":{}}' });
    expect(cihazSecimiOku(depo)).toEqual({ giris: null, cikis: null });
  });

  it("bos metin null sayilir", () => {
    const depo = sahteDepo({ kovan_ses_cihazlari: '{"giris":"","cikis":"c"}' });
    expect(cihazSecimiOku(depo)).toEqual({ giris: null, cikis: "c" });
  });

  it("yazma engelliyse patlamaz", () => {
    const depo: DepoBenzeri = {
      getItem: () => null,
      setItem: () => { throw new Error("kota dolu"); },
    };
    expect(() => cihazSecimiYaz({ giris: "a", cikis: null }, depo)).not.toThrow();
  });

  it("depo yoksa varsayilan doner", () => {
    expect(cihazSecimiOku(null)).toEqual(CIHAZ_SECIMI_VARSAYILAN);
  });
});
