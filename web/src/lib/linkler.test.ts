import { describe, it, expect } from "vitest";
import { parcala } from "./linkler";

const metin = (m: string) => ({ tur: "metin", metin: m });
const link = (m: string, href = m) => ({ tur: "link", metin: m, href });

describe("parcala", () => {
  it("linksiz mesaj tek metin parcasidir", () => {
    expect(parcala("selam nasilsin")).toEqual([metin("selam nasilsin")]);
  });

  it("bos mesaj parca uretmez", () => {
    expect(parcala("")).toEqual([]);
  });

  it("tek basina link", () => {
    expect(parcala("https://kovan-web.pages.dev")).toEqual([link("https://kovan-web.pages.dev")]);
  });

  it("cumlenin ortasindaki link", () => {
    expect(parcala("bak https://a.com/x?y=1 suna")).toEqual([
      metin("bak "), link("https://a.com/x?y=1"), metin(" suna"),
    ]);
  });

  it("birden fazla link", () => {
    expect(parcala("http://a.com ve https://b.com")).toEqual([
      link("http://a.com"), metin(" ve "), link("https://b.com"),
    ]);
  });

  it("www ile baslayan link https'e tamamlanir, gorunen metin degismez", () => {
    expect(parcala("www.youtube.com/watch?v=1")).toEqual([
      link("www.youtube.com/watch?v=1", "https://www.youtube.com/watch?v=1"),
    ]);
  });

  it("buyuk harfli sema da taninir", () => {
    expect(parcala("HTTPS://A.COM")).toEqual([link("HTTPS://A.COM")]);
  });

  /**
   * Cumle sonu noktalamasi linke YAPISIRSA tiklanan adres bozulur:
   * "https://a.com." 404 verir. Sondaki noktalama metne birakilir.
   */
  it("sondaki nokta, virgul, unlem ve soru isareti linke dahil degil", () => {
    for (const isaret of [".", ",", "!", "?", ":", ";"]) {
      expect(parcala(`https://a.com${isaret}`), isaret).toEqual([link("https://a.com"), metin(isaret)]);
    }
  });

  it("birden fazla sondaki isaret de ayrilir", () => {
    expect(parcala("https://a.com?!")).toEqual([link("https://a.com"), metin("?!")]);
  });

  it("paranteze alinmis link kapanis parantezini almaz", () => {
    expect(parcala("(https://a.com)")).toEqual([metin("("), link("https://a.com"), metin(")")]);
  });

  /** Vikipedi adresleri parantezi yolun parcasi olarak tasir. */
  it("yolun icindeki dengeli parantez korunur", () => {
    const u = "https://tr.wikipedia.org/wiki/Kovan_(arıcılık)";
    expect(parcala(u)).toEqual([link(u)]);
  });

  it("Turkce karakterli yol korunur", () => {
    expect(parcala("https://a.com/ağaç/şeker")).toEqual([link("https://a.com/ağaç/şeker")]);
  });

  /** Guvenlik: tiklanabilir olan yalniz http(s). */
  it("javascript ve data semalari link olmaz", () => {
    expect(parcala("javascript:alert(1)")).toEqual([metin("javascript:alert(1)")]);
    expect(parcala("data:text/html,<b>x</b>")).toEqual([metin("data:text/html,<b>x</b>")]);
  });

  it("semasi olup adresi olmayan metin link olmaz", () => {
    expect(parcala("https://")).toEqual([metin("https://")]);
  });

  /** Parcalama kayipsizdir: birlestirilince mesajin kendisi geri gelir. */
  it("parcalar birlesince orijinal metin cikar", () => {
    const ornekler = [
      "bak https://a.com. sonra (www.b.com) ve https://c.com/x_(y)?!",
      "satir\nhttps://a.com\n\nbitti",
      "  bosluklu   https://a.com   ",
    ];
    for (const o of ornekler) {
      expect(parcala(o).map((p) => p.metin).join("")).toBe(o);
    }
  });
});
