import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SesTestcisi, GERI_DINLEME_TAVAN_MS } from "./ses-testi";
import { sahteCtx } from "./test-destek";

function sahteTrack() {
  return { kind: "audio", stop: vi.fn(), addEventListener: vi.fn() } as unknown as MediaStreamTrack;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("bip", () => {
  it("osilator baslatilir ve durdurulur", () => {
    const ctx = sahteCtx();
    new SesTestcisi(ctx).bip();
    const osc = (ctx.createOscillator as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(osc.start).toHaveBeenCalled();
    expect(osc.stop).toHaveBeenCalled();
  });
});

describe("geri dinleme", () => {
  it("basla kaynagi baglar, bitir cozer", () => {
    const ctx = sahteCtx();
    const t = new SesTestcisi(ctx);
    t.geriDinlemeBasla(sahteTrack());
    const kaynak = (ctx.createMediaStreamSource as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(kaynak.connect).toHaveBeenCalled();

    t.geriDinlemeBitir();
    expect(kaynak.disconnect).toHaveBeenCalled();
  });

  it("iki kez baslatmak ikinci kaynak acmaz", () => {
    const ctx = sahteCtx();
    const t = new SesTestcisi(ctx);
    t.geriDinlemeBasla(sahteTrack());
    t.geriDinlemeBasla(sahteTrack());
    expect(ctx.createMediaStreamSource).toHaveBeenCalledTimes(1);
  });

  /** pointerup pencere disinda kaybolabilir; sonsuz geri besleme olmamali. */
  it("tavan suresinde kendiliginden durur", () => {
    const ctx = sahteCtx();
    const t = new SesTestcisi(ctx);
    t.geriDinlemeBasla(sahteTrack());
    const kaynak = (ctx.createMediaStreamSource as ReturnType<typeof vi.fn>).mock.results[0].value;

    vi.advanceTimersByTime(GERI_DINLEME_TAVAN_MS + 1);

    expect(kaynak.disconnect).toHaveBeenCalled();
  });

  /** Context oturumun; testci onu KAPATMAZ, yoksa ses komple olur. */
  it("kapat odunc context'i kapatmaz", () => {
    const ctx = sahteCtx();
    const t = new SesTestcisi(ctx);
    t.geriDinlemeBasla(sahteTrack());
    t.kapat();
    expect(ctx.close).not.toHaveBeenCalled();
  });
});
