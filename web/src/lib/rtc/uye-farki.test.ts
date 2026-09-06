import { describe, it, expect } from "vitest";
import { uyeFarki } from "./uye-farki";

describe("uye farki", () => {
  it("listeye eklenen kisi giren olarak bildirilir", () => {
    const fark = uyeFarki(["u1"], ["u1", "u2"], "u1");

    expect(fark.girenler).toEqual(["u2"]);
  });

  it("listeden dusen kisi cikan olarak bildirilir", () => {
    const fark = uyeFarki(["u1", "u2"], ["u1"], "u1");

    expect(fark.cikanlar).toEqual(["u2"]);
  });

  /**
   * Kendi katilimin `voice.members` listesine kendi id'ni koyuyor. Suzulmezse
   * kanala girdiginde kendi "baskasi girdi" bipini duyarsin.
   */
  it("kendi id'si ne giren ne cikan sayilir", () => {
    const giris = uyeFarki([], ["u1"], "u1");
    const cikis = uyeFarki(["u1"], [], "u1");

    expect(giris.girenler).toEqual([]);
    expect(cikis.cikanlar).toEqual([]);
  });

  /**
   * Kopma sonrasi mesh yeniden kuruluyor ve sunucu tam listeyi bastan
   * gonderiyor. Onceki liste `null` iken fark alinirsa odadaki herkes "yeni
   * girdi" sayilir ve uc bip birden patlar. Tohumlanana kadar sessiz.
   */
  it("onceki liste yokken hicbir sey bildirilmez", () => {
    const fark = uyeFarki(null, ["u1", "u2", "u3"], "u1");

    expect(fark.girenler).toEqual([]);
    expect(fark.cikanlar).toEqual([]);
  });
});
