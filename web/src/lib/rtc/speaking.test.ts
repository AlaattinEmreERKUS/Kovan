import { describe, it, expect, vi } from "vitest";
import { SpeakingDetector, rmsOf } from "./speaking";

function sahteCtx(orneklem: () => number) {
  return {
    createMediaStreamSource: () => ({ connect: vi.fn(), disconnect: vi.fn() }),
    createAnalyser: () => ({
      fftSize: 2048,
      getFloatTimeDomainData: (b: Float32Array) => b.fill(orneklem()),
      connect: vi.fn(), disconnect: vi.fn(),
    }),
    close: vi.fn(),
  } as unknown as AudioContext;
}

describe("rmsOf", () => {
  it("sessizlikte sifir doner", () => {
    expect(rmsOf(new Float32Array(8))).toBe(0);
  });
  it("sabit genlikte o genligi doner", () => {
    const b = new Float32Array(8).fill(0.5);
    expect(rmsOf(b)).toBeCloseTo(0.5, 5);
  });
});

describe("SpeakingDetector", () => {
  it("esigi asinca konusuyor der", () => {
    vi.useFakeTimers();
    const olaylar: Array<[string, boolean]> = [];
    const d = new SpeakingDetector({
      ctx: sahteCtx(() => 0.2),
      threshold: 0.05,
      onChange: (id, s) => olaylar.push([id, s]),
      makeStream: () => ({} as MediaStream),
    });
    d.watch("u1", {} as MediaStreamTrack);
    vi.advanceTimersByTime(200);
    expect(olaylar).toContainEqual(["u1", true]);
    d.stop();
    vi.useRealTimers();
  });

  it("esigin altinda konusmuyor der ve tekrar tekrar yaymaz", () => {
    vi.useFakeTimers();
    const olaylar: Array<[string, boolean]> = [];
    const d = new SpeakingDetector({
      ctx: sahteCtx(() => 0.001),
      threshold: 0.05,
      onChange: (id, s) => olaylar.push([id, s]),
      makeStream: () => ({} as MediaStream),
    });
    d.watch("u1", {} as MediaStreamTrack);
    vi.advanceTimersByTime(1000);
    expect(olaylar.filter(([, s]) => s)).toHaveLength(0);
    // Durum degismedigi surece olay yayilmaz.
    expect(olaylar.length).toBeLessThanOrEqual(1);
    d.stop();
    vi.useRealTimers();
  });

  it("unwatch sonrasi olay uretmez", () => {
    vi.useFakeTimers();
    const olaylar: unknown[] = [];
    const d = new SpeakingDetector({
      ctx: sahteCtx(() => 0.2), threshold: 0.05,
      onChange: (id, s) => olaylar.push([id, s]),
      makeStream: () => ({} as MediaStream),
    });
    d.watch("u1", {} as MediaStreamTrack);
    vi.advanceTimersByTime(200);
    const sayi = olaylar.length;
    d.unwatch("u1");
    vi.advanceTimersByTime(1000);
    expect(olaylar).toHaveLength(sayi);
    d.stop();
    vi.useRealTimers();
  });
});
