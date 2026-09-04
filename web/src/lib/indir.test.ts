import { describe, it, expect } from "vitest";
import { indirmeGorunsun, indirmeKapat, type DepoBenzeri } from "./indir";

function sahteDepo(baslangic: Record<string, string> = {}): DepoBenzeri {
  const veri = { ...baslangic };
  return {
    getItem: (a) => (a in veri ? veri[a] : null),
    setItem: (a, d) => { veri[a] = d; },
  };
}

describe("indirmeGorunsun", () => {
  it("masaustunde hic gorunmez", () => {
    // Zaten masaustu uygulamasindasin; indirme cagrisi anlamsiz olurdu.
    expect(indirmeGorunsun(true, sahteDepo())).toBe(false);
  });

  it("tarayicida ve kapatilmamissa gorunur", () => {
    expect(indirmeGorunsun(false, sahteDepo())).toBe(true);
  });

  it("kapatildiktan sonra bir daha gorunmez", () => {
    const depo = sahteDepo();
    indirmeKapat(depo);
    expect(indirmeGorunsun(false, depo)).toBe(false);
  });

  it("kapatma masaustu kararini degistirmez", () => {
    const depo = sahteDepo();
    indirmeKapat(depo);
    expect(indirmeGorunsun(true, depo)).toBe(false);
  });

  it("depo yoksa gorunur", () => {
    // Gizli sekmede ya da site verisi engelliyken tercih okunamaz; serit
    // gorunmemektense gorunsun, kapat dugmesi zaten duruyor.
    expect(indirmeGorunsun(false, null)).toBe(true);
  });

  it("taninmayan deger kapatilmis sayilmaz", () => {
    expect(indirmeGorunsun(false, sahteDepo({ kovan_indir_seridi: "zart" }))).toBe(true);
  });
});
