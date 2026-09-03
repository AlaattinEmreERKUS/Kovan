import { describe, it, expect, vi } from "vitest";
import { MikrofonIsleyici } from "./mikrofon";
import { BEKLEME_MS } from "./kapi";

/** Analyser'in dondurecegi sabit genlik; RMS = |genlik|. */
function sahteCtx(genlikOku: () => number) {
  const gain = {
    gain: { value: 1, setTargetAtTime: vi.fn((v: number) => { gain.gain.value = v; }) },
    connect: vi.fn(), disconnect: vi.fn(),
  };
  const cikisTrack = { kind: "audio", stop: vi.fn() } as unknown as MediaStreamTrack;
  const ctx = {
    currentTime: 0,
    createMediaStreamSource: () => ({ connect: vi.fn(), disconnect: vi.fn() }),
    createAnalyser: () => ({
      fftSize: 2048,
      connect: vi.fn(), disconnect: vi.fn(),
      getFloatTimeDomainData: (b: Float32Array) => b.fill(genlikOku()),
    }),
    createGain: () => gain,
    createMediaStreamDestination: () => ({
      stream: { getAudioTracks: () => [cikisTrack] },
      connect: vi.fn(), disconnect: vi.fn(),
    }),
  } as unknown as AudioContext;
  return { ctx, gain, cikisTrack };
}

const track = {} as MediaStreamTrack;
const stream = () => ({} as MediaStream);

function kur(genlik: { v: number }, esik: number, saat: { t: number }) {
  const { ctx, gain, cikisTrack } = sahteCtx(() => genlik.v);
  const seviyeler: Array<{ seviye: number; acik: boolean }> = [];
  const isleyici = new MikrofonIsleyici({
    ctx, track, esik, makeStream: stream,
    simdi: () => saat.t,
    onSeviye: (seviye, acik) => seviyeler.push({ seviye, acik }),
  });
  return { isleyici, gain, cikisTrack, seviyeler };
}

describe("MikrofonIsleyici", () => {
  it("mesh'e verilecek track hedef dugumunden gelir (ham mikrofon degil)", () => {
    vi.useFakeTimers();
    const { isleyici, cikisTrack } = kur({ v: 0 }, 0.02, { t: 0 });
    expect(isleyici.cikis).toBe(cikisTrack);
    isleyici.close();
    vi.useRealTimers();
  });

  it("kapi kapali baslar: acilis gurultusu gitmez", () => {
    vi.useFakeTimers();
    const { isleyici, gain } = kur({ v: 0 }, 0.02, { t: 0 });
    expect(gain.gain.value).toBe(0);
    isleyici.close();
    vi.useRealTimers();
  });

  it("esigi asan ses kapiyi acar, sessizlik bekleme sonunda kapatir", () => {
    vi.useFakeTimers();
    const genlik = { v: 0.05 };
    const saat = { t: 0 };
    const { isleyici, gain } = kur(genlik, 0.02, saat);

    vi.advanceTimersByTime(50);
    expect(gain.gain.value).toBe(1);

    genlik.v = 0.001;
    saat.t = BEKLEME_MS - 1;
    vi.advanceTimersByTime(50);
    expect(gain.gain.value).toBe(1); // bekleme dolmadi

    saat.t = BEKLEME_MS + 100;
    vi.advanceTimersByTime(50);
    expect(gain.gain.value).toBe(0);

    isleyici.close();
    vi.useRealTimers();
  });

  it("esik 0 iken kapi devrede degil: her sey gecer", () => {
    vi.useFakeTimers();
    const { isleyici, gain } = kur({ v: 0.0001 }, 0, { t: 0 });
    vi.advanceTimersByTime(50);
    expect(gain.gain.value).toBe(1);
    isleyici.close();
    vi.useRealTimers();
  });

  it("setEsik(0) kapiyi hemen acar, sonraki ornegi beklemez", () => {
    vi.useFakeTimers();
    const { isleyici, gain } = kur({ v: 0 }, 0.02, { t: 0 });
    vi.advanceTimersByTime(50);
    expect(gain.gain.value).toBe(0);
    isleyici.setEsik(0);
    expect(gain.gain.value).toBe(1);
    isleyici.close();
    vi.useRealTimers();
  });

  it("seviye geri bildirimi arayuze akar", () => {
    vi.useFakeTimers();
    const { isleyici, seviyeler } = kur({ v: 0.04 }, 0.02, { t: 0 });
    vi.advanceTimersByTime(150);
    expect(seviyeler.length).toBeGreaterThanOrEqual(3);
    expect(seviyeler[0].seviye).toBeCloseTo(0.04, 3);
    expect(seviyeler[0].acik).toBe(true);
    isleyici.close();
    vi.useRealTimers();
  });

  it("close zamanlayiciyi ve cikis track'ini durdurur", () => {
    vi.useFakeTimers();
    const { isleyici, cikisTrack, seviyeler } = kur({ v: 0.05 }, 0.02, { t: 0 });
    vi.advanceTimersByTime(50);
    const sayi = seviyeler.length;
    isleyici.close();
    vi.advanceTimersByTime(200);
    expect(seviyeler.length).toBe(sayi);
    expect(cikisTrack.stop).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("MikrofonIsleyici bas-konus", () => {
  it("bas-konus modunda esik 0 OLSA BILE tus basili degilken kapi kapali", () => {
    // Tuzak: esik 0 "kapi devre disi" demek ve ses etkinliginde her sey gecer.
    // Bas-konusta bu kisayol UYGULANMAMALI, yoksa tus hic islemez.
    vi.useFakeTimers();
    const { isleyici, gain } = kur({ v: 0 }, 0, { t: 0 });
    isleyici.setMod("bas-konus");
    isleyici.setBasili(false);
    vi.advanceTimersByTime(50);
    expect(gain.gain.value).toBe(0);
    isleyici.close();
    vi.useRealTimers();
  });

  it("bas-konus modunda tus basiliyken kapi acik", () => {
    vi.useFakeTimers();
    const { isleyici, gain } = kur({ v: 0 }, 0.015, { t: 0 });
    isleyici.setMod("bas-konus");
    isleyici.setBasili(true);
    vi.advanceTimersByTime(50);
    expect(gain.gain.value).toBe(1);
    isleyici.close();
    vi.useRealTimers();
  });

  it("ses etkinligi modunda tus durumu yok sayilir", () => {
    vi.useFakeTimers();
    const { isleyici, gain } = kur({ v: 0.01 }, 0.9, { t: 0 });
    isleyici.setMod("ses-etkinligi");
    isleyici.setBasili(true);
    vi.advanceTimersByTime(50); // sahte sinyal esigin altinda
    expect(gain.gain.value).toBe(0);
    isleyici.close();
    vi.useRealTimers();
  });

  it("tus birakilinca sonraki ornegi BEKLEMEZ", () => {
    // 50 ms'lik ornekleme araligi bas-konusta dogrudan kesik kelime demek:
    // tus olayi aninda uygulanmali.
    vi.useFakeTimers();
    const { isleyici, gain } = kur({ v: 0 }, 0.015, { t: 0 });
    isleyici.setMod("bas-konus");
    isleyici.setBasili(true);
    expect(gain.gain.value).toBe(1);
    isleyici.setBasili(false);
    expect(gain.gain.value).toBe(0);
    isleyici.close();
    vi.useRealTimers();
  });
});
