import { describe, it, expect, vi } from "vitest";
import { Mesh } from "./mesh";
import type { Peer, SignalPayload } from "./peer";

function sahtePeer() {
  return {
    handleSignal: vi.fn(async (_d: SignalPayload) => {}),
    setTrack: vi.fn(),
    close: vi.fn(),
  };
}

function kur(selfId = "u2") {
  const olusturulan = new Map<string, ReturnType<typeof sahtePeer>>();
  const nezaket = new Map<string, boolean>();
  const gidenler: string[] = [];
  const mesh = new Mesh({
    selfId,
    createPeer: (userId, polite) => {
      const p = sahtePeer();
      olusturulan.set(userId, p);
      nezaket.set(userId, polite);
      return p as unknown as Peer;
    },
    onPeerGone: (id) => gidenler.push(id),
  });
  return { mesh, olusturulan, nezaket, gidenler };
}

describe("Mesh", () => {
  it("kendisi disindaki her uye icin baglanti acar", () => {
    const { mesh, olusturulan } = kur("u2");
    mesh.setMembers(["u1", "u2", "u3"]);
    expect([...olusturulan.keys()].sort()).toEqual(["u1", "u3"]);
    expect(mesh.size).toBe(2);
  });

  it("politeness userId karsilastirmasindan gelir", () => {
    const { mesh, nezaket } = kur("u2");
    mesh.setMembers(["u1", "u2", "u3"]);
    expect(nezaket.get("u1")).toBe(false); // "u2" > "u1"
    expect(nezaket.get("u3")).toBe(true);  // "u2" < "u3"
  });

  it("ayni uye ikinci kez baglanti acmaz", () => {
    const { mesh, olusturulan } = kur("u2");
    mesh.setMembers(["u1", "u2"]);
    const ilk = olusturulan.get("u1");
    mesh.setMembers(["u1", "u2"]);
    expect(olusturulan.get("u1")).toBe(ilk);
    expect(mesh.size).toBe(1);
  });

  it("listeden dusen uyenin baglantisi kapatilir", () => {
    const { mesh, olusturulan, gidenler } = kur("u2");
    mesh.setMembers(["u1", "u2", "u3"]);
    const giden = olusturulan.get("u3")!;
    mesh.setMembers(["u1", "u2"]);
    expect(giden.close).toHaveBeenCalled();
    expect(mesh.has("u3")).toBe(false);
    expect(gidenler).toEqual(["u3"]);
  });

  it("sinyal dogru peer'a gider", () => {
    const { mesh, olusturulan } = kur("u2");
    mesh.setMembers(["u1", "u2", "u3"]);
    const govde = { candidate: { candidate: "a" } };
    mesh.handleSignal("u1", govde);
    expect(olusturulan.get("u1")!.handleSignal).toHaveBeenCalledWith(govde);
    expect(olusturulan.get("u3")!.handleSignal).not.toHaveBeenCalled();
  });

  it("taninmayan gonderenin sinyali sessizce yutulur", () => {
    const { mesh } = kur("u2");
    mesh.setMembers(["u2"]);
    expect(() => mesh.handleSignal("hayalet", { candidate: null })).not.toThrow();
  });

  it("setTrack tum peer'lara yayilir", () => {
    const { mesh, olusturulan } = kur("u2");
    mesh.setMembers(["u1", "u2", "u3"]);
    const t = { kind: "audio" } as MediaStreamTrack;
    mesh.setTrack("mic", t);
    expect(olusturulan.get("u1")!.setTrack).toHaveBeenCalledWith("mic", t);
    expect(olusturulan.get("u3")!.setTrack).toHaveBeenCalledWith("mic", t);
  });

  it("close tum baglantilari kapatir", () => {
    const { mesh, olusturulan } = kur("u2");
    mesh.setMembers(["u1", "u2", "u3"]);
    mesh.close();
    expect(olusturulan.get("u1")!.close).toHaveBeenCalled();
    expect(mesh.size).toBe(0);
  });
});
