import { describe, it, expect, vi } from "vitest";
import { isTauri, kisayolDinle, type KisayolOlayi, type MasaustuKoprusu } from "./masaustu";

/** Gercek kopru yerine gecen sahte: listen'e verilen geri cagrimi saklar. */
function sahteKopru() {
  let yayinla: ((e: { payload: KisayolOlayi }) => void) | null = null;
  const cozuldu = vi.fn();
  const kopru: MasaustuKoprusu = {
    listen: vi.fn(async (_olay, fn) => {
      yayinla = fn as (e: { payload: KisayolOlayi }) => void;
      return cozuldu;
    }),
    // Genel imza her tipe donebilmeli; sahte tek bir tipe baglaniyor.
    invoke: vi.fn(async () => undefined) as unknown as MasaustuKoprusu["invoke"],
  };
  return { kopru, tetikle: (p: KisayolOlayi) => yayinla?.({ payload: p }), cozuldu };
}

describe("isTauri", () => {
  it("Tauri isaretleri yoksa false doner", () => {
    expect(isTauri({})).toBe(false);
  });

  it("__TAURI_INTERNALS__ varsa true doner", () => {
    expect(isTauri({ __TAURI_INTERNALS__: {} })).toBe(true);
  });
});

describe("kisayolDinle", () => {
  it("kisayol olaylarini geri cagrima tasir", async () => {
    const { kopru, tetikle } = sahteKopru();
    const gorulen: KisayolOlayi[] = [];
    await kisayolDinle(kopru, (o) => gorulen.push(o));

    tetikle({ ad: "ptt", durum: "Pressed" });
    tetikle({ ad: "ptt", durum: "Released" });

    expect(gorulen).toEqual([
      { ad: "ptt", durum: "Pressed" },
      { ad: "ptt", durum: "Released" },
    ]);
  });

  it("bilinmeyen kisayol adini yok sayar", async () => {
    // Rust tarafi degisirse arayuz patlamamali; bilinmeyen ad sessizce atlanir.
    const { kopru, tetikle } = sahteKopru();
    const gorulen: KisayolOlayi[] = [];
    await kisayolDinle(kopru, (o) => gorulen.push(o));

    tetikle({ ad: "bilinmeyen", durum: "Pressed" } as unknown as KisayolOlayi);

    expect(gorulen).toEqual([]);
  });

  it("cozme fonksiyonunu geri verir", async () => {
    const { kopru, cozuldu } = sahteKopru();
    const coz = await kisayolDinle(kopru, () => {});
    coz();
    expect(cozuldu).toHaveBeenCalled();
  });
});
