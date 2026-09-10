import { describe, it, expect } from "vitest";
import { IKONLAR, IKON_ADLARI, type IkonAdi } from "./icons";

describe("ikon seti", () => {
  it("beklenen on yedi ikonu icerir", () => {
    const beklenen: IkonAdi[] = [
      "mik", "mik-kapali", "kulaklik", "kulaklik-kapali",
      "kamera", "kamera-kapali", "ekran", "gorunum", "ayril",
      "uyari", "hoparlor", "buyut", "kucult", "ayar", "kanal-metin", "kanal-ses",
      "ok-yukari",
    ];
    expect([...IKON_ADLARI].sort()).toEqual([...beklenen].sort());
  });

  it("her ikonun govdesi dolu cizim icerir", () => {
    for (const ad of IKON_ADLARI) {
      expect(IKONLAR[ad], ad).toMatch(/<(path|rect|circle)\b/);
      expect(IKONLAR[ad], ad).toContain("currentColor");
    }
  });

  it("kapali varyantlar cizgi tasir", () => {
    // Uzeri cizili varyant, acik varyanttan daha fazla cizim ogesi icermeli.
    const ciftler: Array<[IkonAdi, IkonAdi]> = [
      ["mik", "mik-kapali"],
      ["kulaklik", "kulaklik-kapali"],
      ["kamera", "kamera-kapali"],
    ];
    const say = (s: string) => (s.match(/<(path|rect|circle)\b/g) ?? []).length;
    for (const [acik, kapali] of ciftler) {
      expect(say(IKONLAR[kapali]), kapali).toBeGreaterThan(say(IKONLAR[acik]));
    }
  });

  it("hicbir ikonda sabit renk yok", () => {
    // Ham hex, tokens.css disina cikmak demek.
    for (const ad of IKON_ADLARI) {
      expect(IKONLAR[ad], ad).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    }
  });
});
