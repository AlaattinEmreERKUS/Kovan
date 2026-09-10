import { describe, it, expect } from "vitest";
import {
  EKRAN_KALITESI_VARSAYILAN, ekranKalitesiOku, ekranKalitesiYaz,
  ekranKisitlari, icerikIpucu,
} from "./ekran-kalitesi";
import type { DepoBenzeri } from "./ses-ayarlari";

function sahteDepo(baslangic: Record<string, string> = {}): DepoBenzeri {
  const veri = { ...baslangic };
  return {
    getItem: (k) => (k in veri ? veri[k] : null),
    setItem: (k, v) => { veri[k] = v; },
  };
}

/**
 * Varsayilan, bu ozellikten ONCEKI davranistir: kaynak cozunurluk, 30 fps.
 * Menuye hic dokunmayan kullanicida hicbir sey degismemeli.
 */
describe("varsayilan", () => {
  it("kaynak cozunurluk, 30 fps", () => {
    expect(EKRAN_KALITESI_VARSAYILAN).toEqual({ cozunurluk: "kaynak", fps: 30 });
  });
});

describe("ekran kalitesi kaliciligi", () => {
  it("kayit yoksa varsayilana duser", () => {
    expect(ekranKalitesiOku(sahteDepo())).toEqual(EKRAN_KALITESI_VARSAYILAN);
  });

  it("yazilan secim geri okunur", () => {
    const depo = sahteDepo();
    ekranKalitesiYaz({ cozunurluk: "720p", fps: 60 }, depo);
    expect(ekranKalitesiOku(depo)).toEqual({ cozunurluk: "720p", fps: 60 });
  });

  it("bozuk JSON uygulamayi durdurmaz", () => {
    const depo = sahteDepo({ kovan_ekran_kalitesi: "{bozuk" });
    expect(ekranKalitesiOku(depo)).toEqual(EKRAN_KALITESI_VARSAYILAN);
  });

  /** Menude olmayan deger (elle bozulmus, eski surum) alan bazinda duser. */
  it("taninmayan cozunurluk ve fps varsayilana duser", () => {
    const depo = sahteDepo({ kovan_ekran_kalitesi: '{"cozunurluk":"4k","fps":144}' });
    expect(ekranKalitesiOku(depo)).toEqual(EKRAN_KALITESI_VARSAYILAN);
  });

  it("gecerli alan korunur, gecersiz olan duser", () => {
    const depo = sahteDepo({ kovan_ekran_kalitesi: '{"cozunurluk":"1080p","fps":"60"}' });
    expect(ekranKalitesiOku(depo)).toEqual({ cozunurluk: "1080p", fps: 30 });
  });

  it("yazma engelliyse patlamaz", () => {
    const depo: DepoBenzeri = {
      getItem: () => null,
      setItem: () => { throw new Error("kota dolu"); },
    };
    expect(() => ekranKalitesiYaz({ cozunurluk: "720p", fps: 15 }, depo)).not.toThrow();
  });

  it("depo yoksa varsayilan doner", () => {
    expect(ekranKalitesiOku(null)).toEqual(EKRAN_KALITESI_VARSAYILAN);
  });
});

describe("ekranKisitlari", () => {
  it("720p en fazla 1280x720 ister", () => {
    expect(ekranKisitlari({ cozunurluk: "720p", fps: 30 })).toEqual({
      width: { max: 1280 }, height: { max: 720 }, frameRate: 30,
    });
  });

  it("1080p en fazla 1920x1080 ister", () => {
    expect(ekranKisitlari({ cozunurluk: "1080p", fps: 60 })).toEqual({
      width: { max: 1920 }, height: { max: 1080 }, frameRate: 60,
    });
  });

  /**
   * applyConstraints kisit setini TUMUYLE degistirir. Kaynak'ta boyut alani
   * hic olmamali: `undefined` degerli bir anahtar bile birakilirsa tarayicinin
   * onu nasil yorumlayacagi belirsiz, 720p'den donuste kisit takili kalabilir.
   */
  it("kaynak boyut kisiti TASIMAZ, yalniz fps", () => {
    const k = ekranKisitlari({ cozunurluk: "kaynak", fps: 15 });
    expect(k).toEqual({ frameRate: 15 });
    expect(Object.keys(k)).toEqual(["frameRate"]);
  });
});

/**
 * contentHint encoder'a neyi feda edecegini soyler. "motion": fps korunur,
 * gerekirse cozunurluk duser (oyun). "detail": cozunurluk korunur, gerekirse
 * fps duser (yazi, kod).
 */
describe("icerikIpucu", () => {
  it("60 fps akicilik ister", () => {
    expect(icerikIpucu({ cozunurluk: "kaynak", fps: 60 })).toBe("motion");
  });

  it("30 ve 15 fps okunaklilik ister", () => {
    expect(icerikIpucu({ cozunurluk: "kaynak", fps: 30 })).toBe("detail");
    expect(icerikIpucu({ cozunurluk: "720p", fps: 15 })).toBe("detail");
  });
});
