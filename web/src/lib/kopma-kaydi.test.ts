import { describe, expect, it } from "vitest";
import { KAYIT_TAVANI, kopmaKaydet, kopmalariOku } from "./kopma-kaydi";
import type { DepoBenzeri } from "./gorunum";

function sahteDepo(): DepoBenzeri & { veri: Map<string, string> } {
  const veri = new Map<string, string>();
  return {
    veri,
    getItem: (k) => veri.get(k) ?? null,
    setItem: (k, v) => { veri.set(k, v); },
  };
}

describe("kopma kaydi", () => {
  it("bos depoda bos liste doner", () => {
    expect(kopmalariOku(sahteDepo())).toEqual([]);
  });

  it("kaydedilen olay saat damgasiyla geri okunur", () => {
    const depo = sahteDepo();
    kopmaKaydet({ tur: "ws", kod: 1006, sebep: "", temiz: false, acikKaldiSn: 1800 }, depo, 1000);
    expect(kopmalariOku(depo)).toEqual([
      { zaman: new Date(1000).toISOString(), tur: "ws", kod: 1006, sebep: "", temiz: false, acikKaldiSn: 1800 },
    ]);
  });

  it("tavani asinca en eskiler duser", () => {
    const depo = sahteDepo();
    for (let i = 0; i < KAYIT_TAVANI + 5; i++) {
      kopmaKaydet({ tur: "peer", userId: `u${i}`, durum: "failed" }, depo, i);
    }
    const kayitlar = kopmalariOku(depo);
    expect(kayitlar).toHaveLength(KAYIT_TAVANI);
    expect(kayitlar[0]).toMatchObject({ userId: "u5" });
  });

  it("bozuk depo verisi kaydi engellemez", () => {
    const depo = sahteDepo();
    depo.veri.set("kovan_kopmalar", "{bozuk");
    kopmaKaydet({ tur: "peer", userId: "a", durum: "disconnected" }, depo, 0);
    expect(kopmalariOku(depo)).toHaveLength(1);
  });

  it("yazma istisnasi disari sizmaz", () => {
    const depo: DepoBenzeri = {
      getItem: () => null,
      setItem: () => { throw new Error("kota"); },
    };
    expect(() => kopmaKaydet({ tur: "peer", userId: "a", durum: "failed" }, depo, 0)).not.toThrow();
  });
});
