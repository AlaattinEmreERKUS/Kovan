import { describe, it, expect, vi } from "vitest";
import { SES_VARSAYILAN, ekranMikseri, mikrofonMikseri } from "./gain";

function sahteCtx() {
  const gains: Array<{ gain: { value: number }; disconnect: ReturnType<typeof vi.fn> }> = [];
  const ctx = {
    destination: {},
    createMediaStreamSource: () => ({ connect: vi.fn(), disconnect: vi.fn() }),
    createGain: () => {
      const g = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
      gains.push(g);
      return g;
    },
  } as unknown as AudioContext;
  return { ctx, gains };
}

function sahteStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

const track = {} as MediaStreamTrack;
const stream = () => ({} as MediaStream);

describe("RemoteAudioMixer", () => {
  it("varsayilan seviye 100", () => {
    const { ctx } = sahteCtx();
    const m = ekranMikseri(ctx, sahteStorage(), stream);
    expect(m.volumeOf("u1")).toBe(SES_VARSAYILAN);
  });

  it("100 seviyesi gain 1 demek", () => {
    const { ctx, gains } = sahteCtx();
    const m = ekranMikseri(ctx, sahteStorage(), stream);
    m.attach("u1", track);
    expect(gains[0].gain.value).toBeCloseTo(1);
  });

  it("200 seviyesi gain 2 ile yukseltir", () => {
    const { ctx, gains } = sahteCtx();
    const m = ekranMikseri(ctx, sahteStorage(), stream);
    m.attach("u1", track);
    m.setVolume("u1", 200);
    expect(gains[0].gain.value).toBeCloseTo(2);
  });

  it("0 seviyesi sustur", () => {
    const { ctx, gains } = sahteCtx();
    const m = ekranMikseri(ctx, sahteStorage(), stream);
    m.attach("u1", track);
    m.setVolume("u1", 0);
    expect(gains[0].gain.value).toBe(0);
  });

  it("seviye lokalde saklanir ve yeni oturumda geri gelir", () => {
    const depo = sahteStorage();
    const a = ekranMikseri(sahteCtx().ctx, depo, stream);
    a.setVolume("u1", 150);

    const b = ekranMikseri(sahteCtx().ctx, depo, stream);
    expect(b.volumeOf("u1")).toBe(150);
    expect(b.volumeOf("baskasi")).toBe(SES_VARSAYILAN);
  });

  it("seviye kisiye ozeldir: farkli kullanicilar birbirini etkilemez", () => {
    const { ctx, gains } = sahteCtx();
    const m = ekranMikseri(ctx, sahteStorage(), stream);
    m.attach("u1", track);
    m.attach("u2", track);
    m.setVolume("u1", 0);
    expect(gains[0].gain.value).toBe(0);
    expect(gains[1].gain.value).toBeCloseTo(1);
  });

  it("deafen tum gain'leri sifirlar, cikista eski degerler doner", () => {
    const { ctx, gains } = sahteCtx();
    const m = ekranMikseri(ctx, sahteStorage(), stream);
    m.attach("u1", track);
    m.setVolume("u1", 150);
    m.setDeafened(true);
    expect(gains[0].gain.value).toBe(0);
    m.setDeafened(false);
    expect(gains[0].gain.value).toBeCloseTo(1.5);
  });

  it("deafen acikken baglanan yeni paylasim da sessiz baslar", () => {
    const { ctx, gains } = sahteCtx();
    const m = ekranMikseri(ctx, sahteStorage(), stream);
    m.setDeafened(true);
    m.attach("u1", track);
    expect(gains[0].gain.value).toBe(0);
  });

  it("detach zinciri cozer", () => {
    const { ctx, gains } = sahteCtx();
    const m = ekranMikseri(ctx, sahteStorage(), stream);
    m.attach("u1", track);
    m.detach("u1");
    expect(gains[0].disconnect).toHaveBeenCalled();
    // Seviye hafizada kalir: ayni kisi tekrar paylasirsa ayni seviyede acilir.
    expect(m.volumeOf("u1")).toBe(SES_VARSAYILAN);
  });
});

describe("mikser onekleri", () => {
  it("ekran ve mikrofon seviyeleri ayri saklanir", () => {
    const depo = sahteStorage();
    const ekran = ekranMikseri(sahteCtx().ctx, depo, stream);
    const mik = mikrofonMikseri(sahteCtx().ctx, depo, stream);

    ekran.setVolume("u1", 40);
    expect(mik.volumeOf("u1")).toBe(SES_VARSAYILAN);

    mik.setVolume("u1", 180);
    expect(ekran.volumeOf("u1")).toBe(40);
  });

  it("mikrofon seviyesi de kalicidir", () => {
    const depo = sahteStorage();
    mikrofonMikseri(sahteCtx().ctx, depo, stream).setVolume("u2", 25);
    expect(mikrofonMikseri(sahteCtx().ctx, depo, stream).volumeOf("u2")).toBe(25);
  });
});
