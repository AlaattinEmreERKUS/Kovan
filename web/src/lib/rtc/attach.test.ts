import { describe, it, expect, vi, beforeAll } from "vitest";
import { attachStream } from "./attach";

class SahteStream {
  constructor(private izler: MediaStreamTrack[]) {}
  getTracks() { return this.izler; }
}

beforeAll(() => {
  (globalThis as { MediaStream?: unknown }).MediaStream = SahteStream;
});

function sahteTrack(ad: string): MediaStreamTrack {
  return { id: ad, kind: "video" } as unknown as MediaStreamTrack;
}

/** `paused` gercek elemanda salt okunur; sahtede testin yazabilmesi gerekir. */
type SahteNode = Omit<HTMLMediaElement, "paused"> & {
  paused: boolean;
  playCagrisi: number;
};

/** `paused` baslangicta true: gercek <video> de kaynak baglanana kadar duraklidir. */
function sahteNode(reddet = false): SahteNode {
  const node = {
    srcObject: null,
    paused: true,
    playCagrisi: 0,
    play() {
      node.playCagrisi++;
      // Reddedildiginde bile tarayici oynatmayi baslatmis saymaz.
      if (reddet) return Promise.reject(new DOMException("blocked", "NotAllowedError"));
      node.paused = false;
      return Promise.resolve();
    },
  };
  return node as unknown as SahteNode;
}

describe("attachStream", () => {
  it("track'i elemana baglar", () => {
    const node = sahteNode();
    const t = sahteTrack("a");
    attachStream(node, t);
    expect((node.srcObject as unknown as SahteStream).getTracks()).toEqual([t]);
  });

  it("ayni track ile update srcObject'e DOKUNMAZ", () => {
    // Svelte action update'i her prop degisiminde cagriliyor: safe_not_equal
    // nesneler icin daima true doner. srcObject'i yeniden yazmak <video>'yu
    // sifirlar ve bir kare siyah cizdirir -- titremenin kaynagi buydu.
    const node = sahteNode();
    const t = sahteTrack("a");
    const p = attachStream(node, t);
    const ilk = node.srcObject;
    p.update(t);
    p.update(t);
    expect(node.srcObject).toBe(ilk);
  });

  it("track degisince yeniden baglar", () => {
    const node = sahteNode();
    const p = attachStream(node, sahteTrack("a"));
    const ilk = node.srcObject;
    const yeni = sahteTrack("b");
    p.update(yeni);
    expect(node.srcObject).not.toBe(ilk);
    expect((node.srcObject as unknown as SahteStream).getTracks()).toEqual([yeni]);
  });

  it("destroy srcObject'i temizler", () => {
    const node = sahteNode();
    const p = attachStream(node, sahteTrack("a"));
    p.destroy();
    expect(node.srcObject).toBeNull();
  });

  it("srcObject disaridan bosaltilmissa yeniden baglar", () => {
    const node = sahteNode();
    const t = sahteTrack("a");
    const p = attachStream(node, t);
    node.srcObject = null;
    p.update(t);
    expect(node.srcObject).not.toBeNull();
  });
});

describe("attachStream oynatma", () => {
  it("baglayinca oynatmayi baslatir", () => {
    // `autoplay` ozniteligi tek basina yetmiyor: elemanin "can autoplay"
    // bayragi bir kez tuketilince srcObject'e yazmak oynatmayi baslatmaz.
    const node = sahteNode();
    attachStream(node, sahteTrack("a"));
    expect(node.playCagrisi).toBe(1);
    expect(node.paused).toBe(false);
  });

  it("ayni track ile update'te duraklamis videoyu devam ettirir", () => {
    // Asil hata buydu: tarayici oynatmayi hic baslatmayinca kare siyah
    // kaliyordu. srcObject dogru, izler canli, readyState 4 -- yalniz
    // `paused: true`. Ayni track geldiginde srcObject'e DOKUNULMAZ ama
    // oynatma yine de kurtarilmalidir.
    const node = sahteNode();
    const t = sahteTrack("a");
    const p = attachStream(node, t);
    const ilk = node.srcObject;
    node.paused = true;

    p.update(t);

    expect(node.srcObject).toBe(ilk);
    expect(node.paused).toBe(false);
    expect(node.playCagrisi).toBe(2);
  });

  it("zaten oynayan videoya play() cagirmaz", () => {
    const node = sahteNode();
    const t = sahteTrack("a");
    const p = attachStream(node, t);
    p.update(t);
    expect(node.playCagrisi).toBe(1);
  });

  it("play() reddedilirse hata sizdirmaz", async () => {
    // Tarayici otomatik oynatmayi engelleyebilir; bu bir ariza degil.
    const node = sahteNode(true);
    expect(() => attachStream(node, sahteTrack("a"))).not.toThrow();
    await Promise.resolve();
    expect(node.playCagrisi).toBe(1);
  });
});
