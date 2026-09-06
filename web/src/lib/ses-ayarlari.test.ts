import { describe, it, expect } from "vitest";
import {
  ESIK_MAKS, SES_AYARI_VARSAYILAN, mikKisitlari, sesAyarlariOku, sesAyarlariYaz,
  type DepoBenzeri,
} from "./ses-ayarlari";

function depo(baslangic: Record<string, string> = {}): DepoBenzeri {
  const m = new Map(Object.entries(baslangic));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

describe("ses ayarlari", () => {
  it("kayit yokken varsayilan doner", () => {
    expect(sesAyarlariOku(depo())).toEqual(SES_AYARI_VARSAYILAN);
  });

  it("yazilan ayar geri okunur", () => {
    const d = depo();
    sesAyarlariYaz({ ...SES_AYARI_VARSAYILAN, esik: 0.04, yankiEngelleme: false, gurultuBastirma: false, otomatikSeviye: true }, d);
    expect(sesAyarlariOku(d)).toEqual({
      ...SES_AYARI_VARSAYILAN, esik: 0.04, yankiEngelleme: false, gurultuBastirma: false, otomatikSeviye: true,
    });
  });

  it("esik araliga kirpilir", () => {
    const d = depo();
    sesAyarlariYaz({ ...SES_AYARI_VARSAYILAN, esik: 99 }, d);
    expect(sesAyarlariOku(d).esik).toBe(ESIK_MAKS);
    sesAyarlariYaz({ ...SES_AYARI_VARSAYILAN, esik: -5 }, d);
    expect(sesAyarlariOku(d).esik).toBe(0);
  });

  it("bozuk kayit uygulamayi durdurmaz", () => {
    expect(sesAyarlariOku(depo({ kovan_ses_ayarlari: "{bozuk" }))).toEqual(SES_AYARI_VARSAYILAN);
  });

  it("eksik alanlar varsayilanla tamamlanir", () => {
    const d = depo({ kovan_ses_ayarlari: JSON.stringify({ esik: 0.03 }) });
    expect(sesAyarlariOku(d)).toEqual({ ...SES_AYARI_VARSAYILAN, esik: 0.03 });
  });

  it("depo yokken calisir", () => {
    expect(sesAyarlariOku(null)).toEqual(SES_AYARI_VARSAYILAN);
    expect(() => sesAyarlariYaz(SES_AYARI_VARSAYILAN, null)).not.toThrow();
  });

  it("kisitlar tarayici adlarina cevrilir", () => {
    expect(mikKisitlari({ ...SES_AYARI_VARSAYILAN, esik: 0, yankiEngelleme: true, gurultuBastirma: false, otomatikSeviye: true }))
      .toEqual({ echoCancellation: true, noiseSuppression: false, autoGainControl: true });
  });
});

describe("giris modu", () => {
  function sahteDepo(baslangic: string | null) {
    let deger = baslangic;
    return {
      getItem: () => deger,
      setItem: (_a: string, d: string) => { deger = d; },
      oku: () => deger,
    };
  }

  it("kayit yoksa ses etkinligi varsayilan", () => {
    expect(sesAyarlariOku(sahteDepo(null)).girisModu).toBe("ses-etkinligi");
  });

  it("kayitli mod okunur", () => {
    const d = sahteDepo(JSON.stringify({ girisModu: "bas-konus" }));
    expect(sesAyarlariOku(d).girisModu).toBe("bas-konus");
  });

  it("taninmayan mod varsayilana duser", () => {
    // Eski surumden kalan ya da elle bozulmus kayit uygulamayi durdurmamali.
    const d = sahteDepo(JSON.stringify({ girisModu: "zart" }));
    expect(sesAyarlariOku(d).girisModu).toBe("ses-etkinligi");
  });

  it("yazilan ayar geri okununca korunur", () => {
    const d = sahteDepo(null);
    sesAyarlariYaz({ ...SES_AYARI_VARSAYILAN, girisModu: "bas-konus" }, d);
    expect(sesAyarlariOku(d).girisModu).toBe("bas-konus");
  });
});

describe("bildirim sesleri ayari", () => {
  it("varsayilan olarak aciktir", () => {
    expect(sesAyarlariOku(depo()).bildirimSesleri).toBe(true);
  });

  it("kapatilinca kalici olur", () => {
    const d = depo();

    sesAyarlariYaz({ ...SES_AYARI_VARSAYILAN, bildirimSesleri: false }, d);

    expect(sesAyarlariOku(d).bildirimSesleri).toBe(false);
  });

  /** Eski kayitta alan yok; okuma patlamamali, varsayilana dusmeli. */
  it("eski kayitta alan yoksa varsayilana duser", () => {
    const d = depo();
    d.setItem("kovan_ses_ayarlari", JSON.stringify({ esik: 0.02 }));

    expect(sesAyarlariOku(d).bildirimSesleri).toBe(true);
  });
});
