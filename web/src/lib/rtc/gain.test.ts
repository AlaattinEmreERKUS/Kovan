import { describe, it, expect, vi } from "vitest";
import { SCREEN_VOLUME_DEFAULT, ScreenAudioMixer } from "./gain";

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

describe("ScreenAudioMixer", () => {
  it("varsayilan seviye 100", () => {
    const { ctx } = sahteCtx();
    const m = new ScreenAudioMixer(ctx, sahteStorage(), stream);
    expect(m.volumeOf("u1")).toBe(SCREEN_VOLUME_DEFAULT);
  });

  it("100 seviyesi gain 1 demek", () => {
    const { ctx, gains } = sahteCtx();
    const m = new ScreenAudioMixer(ctx, sahteStorage(), stream);
    m.attach("u1", track);
    expect(gains[0].gain.value).toBeCloseTo(1);
  });

  it("200 seviyesi gain 2 ile yukseltir", () => {
    const { ctx, gains } = sahteCtx();
    const m = new ScreenAudioMixer(ctx, sahteStorage(), stream);
    m.attach("u1", track);
    m.setVolume("u1", 200);
    expect(gains[0].gain.value).toBeCloseTo(2);
  });

  it("0 seviyesi sustur", () => {
    const { ctx, gains } = sahteCtx();
    const m = new ScreenAudioMixer(ctx, sahteStorage(), stream);
    m.attach("u1", track);
    m.setVolume("u1", 0);
    expect(gains[0].gain.value).toBe(0);
  });

  it("seviye lokalde saklanir ve yeni oturumda geri gelir", () => {
    const depo = sahteStorage();
    const a = new ScreenAudioMixer(sahteCtx().ctx, depo, stream);
    a.setVolume("u1", 150);

    const b = new ScreenAudioMixer(sahteCtx().ctx, depo, stream);
    expect(b.volumeOf("u1")).toBe(150);
    expect(b.volumeOf("baskasi")).toBe(SCREEN_VOLUME_DEFAULT);
  });

  it("seviye kisiye ozeldir: farkli kullanicilar birbirini etkilemez", () => {
    const { ctx, gains } = sahteCtx();
    const m = new ScreenAudioMixer(ctx, sahteStorage(), stream);
    m.attach("u1", track);
    m.attach("u2", track);
    m.setVolume("u1", 0);
    expect(gains[0].gain.value).toBe(0);
    expect(gains[1].gain.value).toBeCloseTo(1);
  });

  it("deafen tum gain'leri sifirlar, cikista eski degerler doner", () => {
    const { ctx, gains } = sahteCtx();
    const m = new ScreenAudioMixer(ctx, sahteStorage(), stream);
    m.attach("u1", track);
    m.setVolume("u1", 150);
    m.setDeafened(true);
    expect(gains[0].gain.value).toBe(0);
    m.setDeafened(false);
    expect(gains[0].gain.value).toBeCloseTo(1.5);
  });

  it("deafen acikken baglanan yeni paylasim da sessiz baslar", () => {
    const { ctx, gains } = sahteCtx();
    const m = new ScreenAudioMixer(ctx, sahteStorage(), stream);
    m.setDeafened(true);
    m.attach("u1", track);
    expect(gains[0].gain.value).toBe(0);
  });

  it("detach zinciri cozer", () => {
    const { ctx, gains } = sahteCtx();
    const m = new ScreenAudioMixer(ctx, sahteStorage(), stream);
    m.attach("u1", track);
    m.detach("u1");
    expect(gains[0].disconnect).toHaveBeenCalled();
    // Seviye hafizada kalir: ayni kisi tekrar paylasirsa ayni seviyede acilir.
    expect(m.volumeOf("u1")).toBe(SCREEN_VOLUME_DEFAULT);
  });
});
