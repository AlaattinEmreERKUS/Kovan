import { describe, it, expect } from "vitest";
import { BEKLEME_MS, kapiKarari, kapiKapali, type KapiDurumu } from "./kapi";

const kapali: KapiDurumu = { acik: false, sonSes: 0 };

/** Ses etkinligi modunun kisa yazimi: bu blokta tus hic basili degil. */
const ses = (seviye: number, esik: number, onceki: KapiDurumu, simdi: number) =>
  kapiKarari({ mod: "ses-etkinligi", seviye, esik, basili: false, onceki, simdi });

describe("kapiKarari", () => {
  it("esigi asinca aninda acilir", () => {
    expect(ses(0.05, 0.02, kapali, 1000)).toEqual({ acik: true, sonSes: 1000 });
  });

  it("esigin altinda BEKLEME suresince acik kalir", () => {
    const acik = ses(0.05, 0.02, kapali, 1000);
    const hemenSonra = ses(0.001, 0.02, acik, 1000 + BEKLEME_MS - 1);
    expect(hemenSonra.acik).toBe(true);
  });

  it("bekleme dolunca kapanir", () => {
    const acik = ses(0.05, 0.02, kapali, 1000);
    const sonra = ses(0.001, 0.02, acik, 1000 + BEKLEME_MS);
    expect(sonra.acik).toBe(false);
  });

  it("sessizlikte kapali kalir", () => {
    expect(ses(0.001, 0.02, kapali, 5000).acik).toBe(false);
  });

  it("konusma arasindaki kisa mola kapiyi kapatmaz", () => {
    // 0 ms: ses, 100 ms: sessizlik, 200 ms: ses -> kesintisiz acik.
    let d = ses(0.06, 0.02, kapali, 0);
    d = ses(0.0005, 0.02, d, 100);
    expect(d.acik).toBe(true);
    d = ses(0.06, 0.02, d, 200);
    expect(d).toEqual({ acik: true, sonSes: 200 });
  });

  it("esik tam seviyeye esitse gecer", () => {
    expect(ses(0.02, 0.02, kapali, 10).acik).toBe(true);
  });

  it("esik 0 kapiyi devre disi birakir", () => {
    expect(kapiKapali(0)).toBe(true);
    expect(kapiKapali(0.01)).toBe(false);
  });
});

describe("kapiKarari bas-konus modu", () => {
  const temel = { esik: 0.015, onceki: { acik: false, sonSes: 0 }, simdi: 1000 };

  it("tus basiliyken kapi acik", () => {
    const s = kapiKarari({ ...temel, mod: "bas-konus", seviye: 0, basili: true });
    expect(s.acik).toBe(true);
  });

  it("tus birakildiginda ANINDA kapanir, bekleme uygulanmaz", () => {
    // Ses etkinliginde 250 ms bekleme var; bas-konusta olsaydi tusu
    // biraktiktan sonra ceyrek saniye oda gurultusu yayinlanirdi.
    const basili = kapiKarari({ ...temel, mod: "bas-konus", seviye: 0.5, basili: true });
    const birakildi = kapiKarari({
      ...temel, mod: "bas-konus", seviye: 0.5, basili: false,
      onceki: basili, simdi: temel.simdi + 10,
    });
    expect(birakildi.acik).toBe(false);
  });

  it("seviye esigi assa bile tus basili degilse kapali", () => {
    const s = kapiKarari({ ...temel, mod: "bas-konus", seviye: 0.9, basili: false });
    expect(s.acik).toBe(false);
  });

  it("sonSes'e DOKUNMAZ: moda geri donuldugunde kapi acik kalmasin", () => {
    const onceki = { acik: false, sonSes: 500 };
    const s = kapiKarari({ ...temel, mod: "bas-konus", seviye: 0.9, basili: true, onceki });
    expect(s.sonSes).toBe(500);
  });
});
