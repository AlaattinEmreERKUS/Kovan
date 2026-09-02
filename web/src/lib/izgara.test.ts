import { describe, it, expect } from "vitest";
import { izgaraOlcusu } from "./izgara";

describe("izgaraOlcusu", () => {
  it("tek kare tek sutun", () => {
    expect(izgaraOlcusu(1, 1200, 700)).toEqual({ sutun: 1, satir: 1 });
  });

  it("genis pencerede iki kare yan yana", () => {
    expect(izgaraOlcusu(2, 1600, 500)).toEqual({ sutun: 2, satir: 1 });
  });

  it("dar ve uzun pencerede iki kare alt alta", () => {
    // Napol'un tarifi: "2 taneyse biri ustte digeri altta".
    expect(izgaraOlcusu(2, 600, 900)).toEqual({ sutun: 1, satir: 2 });
  });

  it("dort kare kare duzende toplanir", () => {
    expect(izgaraOlcusu(4, 1200, 700)).toEqual({ sutun: 2, satir: 2 });
  });

  it("uc kare bosluk birakabilir", () => {
    const d = izgaraOlcusu(3, 1200, 700);
    expect(d.sutun * d.satir).toBeGreaterThanOrEqual(3);
  });

  it("secilen duzen alternatiflerinden buyuk kare verir", () => {
    const alan = (sayi: number, en: number, boy: number, sutun: number) => {
      const satir = Math.ceil(sayi / sutun);
      const he = (en - 10 * (sutun - 1)) / sutun;
      const hb = (boy - 10 * (satir - 1)) / satir;
      const ke = Math.min(he, hb * (16 / 9));
      return ke * (ke / (16 / 9));
    };
    for (const [sayi, en, boy] of [[2, 1600, 500], [2, 600, 900], [5, 1000, 800], [7, 1400, 600]]) {
      const secilen = izgaraOlcusu(sayi, en, boy);
      for (let s = 1; s <= sayi; s++) {
        expect(alan(sayi, en, boy, secilen.sutun) + 0.001).toBeGreaterThanOrEqual(alan(sayi, en, boy, s));
      }
    }
  });

  it("olcum yokken cokmez", () => {
    expect(izgaraOlcusu(3, 0, 0)).toEqual({ sutun: 1, satir: 3 });
    expect(izgaraOlcusu(0, 800, 600)).toEqual({ sutun: 1, satir: 0 });
  });
});
