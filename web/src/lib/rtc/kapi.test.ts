import { describe, it, expect } from "vitest";
import { BEKLEME_MS, kapiKarari, kapiKapali, type KapiDurumu } from "./kapi";

const kapali: KapiDurumu = { acik: false, sonSes: 0 };

describe("kapiKarari", () => {
  it("esigi asinca aninda acilir", () => {
    expect(kapiKarari(0.05, 0.02, kapali, 1000)).toEqual({ acik: true, sonSes: 1000 });
  });

  it("esigin altinda BEKLEME suresince acik kalir", () => {
    const acik = kapiKarari(0.05, 0.02, kapali, 1000);
    const hemenSonra = kapiKarari(0.001, 0.02, acik, 1000 + BEKLEME_MS - 1);
    expect(hemenSonra.acik).toBe(true);
  });

  it("bekleme dolunca kapanir", () => {
    const acik = kapiKarari(0.05, 0.02, kapali, 1000);
    const sonra = kapiKarari(0.001, 0.02, acik, 1000 + BEKLEME_MS);
    expect(sonra.acik).toBe(false);
  });

  it("sessizlikte kapali kalir", () => {
    expect(kapiKarari(0.001, 0.02, kapali, 5000).acik).toBe(false);
  });

  it("konusma arasindaki kisa mola kapiyi kapatmaz", () => {
    // 0 ms: ses, 100 ms: sessizlik, 200 ms: ses -> kesintisiz acik.
    let d = kapiKarari(0.06, 0.02, kapali, 0);
    d = kapiKarari(0.0005, 0.02, d, 100);
    expect(d.acik).toBe(true);
    d = kapiKarari(0.06, 0.02, d, 200);
    expect(d).toEqual({ acik: true, sonSes: 200 });
  });

  it("esik tam seviyeye esitse gecer", () => {
    expect(kapiKarari(0.02, 0.02, kapali, 10).acik).toBe(true);
  });

  it("esik 0 kapiyi devre disi birakir", () => {
    expect(kapiKapali(0)).toBe(true);
    expect(kapiKapali(0.01)).toBe(false);
  });
});
