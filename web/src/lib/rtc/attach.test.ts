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

function sahteNode(): HTMLMediaElement {
  return { srcObject: null } as unknown as HTMLMediaElement;
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
