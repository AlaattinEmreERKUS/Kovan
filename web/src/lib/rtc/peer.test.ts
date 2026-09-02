import { describe, it, expect, vi } from "vitest";
import { Peer, SLOT_ORDER, type SignalPayload } from "./peer";
import { isPolite } from "./politeness";

/** Perfect negotiation'i test etmek icin yeterli en kucuk sahte. */
class SahteTransceiver {
  sender = { replaceTrack: vi.fn(async () => {}) };
  direction: RTCRtpTransceiverDirection = "sendrecv";
  constructor(public kind: "audio" | "video") {}
}

class SahtePC {
  signalingState: RTCSignalingState = "stable";
  connectionState: RTCPeerConnectionState = "new";
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  transceivers: SahteTransceiver[] = [];
  eklenenAdaylar: unknown[] = [];
  kapandi = false;

  onnegotiationneeded: (() => Promise<void> | void) | null = null;
  onicecandidate: ((e: { candidate: RTCIceCandidateInit | null }) => void) | null = null;
  ontrack: ((e: { transceiver: SahteTransceiver; track: MediaStreamTrack }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;

  addTransceiver(kind: "audio" | "video") {
    const t = new SahteTransceiver(kind);
    this.transceivers.push(t);
    return t;
  }
  getTransceivers() { return this.transceivers; }
  async setLocalDescription(desc?: RTCSessionDescriptionInit) {
    this.localDescription = desc ?? {
      type: this.remoteDescription?.type === "offer" ? "answer" : "offer",
      sdp: "yerel-sdp",
    };
    this.signalingState = this.localDescription.type === "offer"
      ? "have-local-offer" : "stable";
  }
  async setRemoteDescription(desc: RTCSessionDescriptionInit) {
    this.remoteDescription = desc;
    this.signalingState = desc.type === "offer" ? "have-remote-offer" : "stable";
    // Gercek tarayici gibi: gelen offer'in m-line'lari icin transceiver acar.
    if (desc.type === "offer" && this.transceivers.length === 0) {
      for (const kind of ["audio", "video", "video", "audio"] as const) {
        this.addTransceiver(kind);
      }
    }
  }
  async addIceCandidate(c: unknown) { this.eklenenAdaylar.push(c); }
  close() { this.kapandi = true; }
}

function kur(polite: boolean) {
  const pc = new SahtePC();
  const gonderilen: SignalPayload[] = [];
  const track: Array<[string, MediaStreamTrack]> = [];
  const peer = new Peer({
    polite,
    pc: pc as unknown as RTCPeerConnection,
    sendSignal: (d) => gonderilen.push(d),
    onTrack: (slot, t) => track.push([slot, t]),
  });
  return { pc, peer, gonderilen, track };
}

describe("isPolite", () => {
  it("kucuk userId polite olur", () => {
    expect(isPolite("a", "b")).toBe(true);
    expect(isPolite("b", "a")).toBe(false);
  });
  it("iki taraf zit sonuc alir", () => {
    expect(isPolite("u1", "u2")).not.toBe(isPolite("u2", "u1"));
  });
});

describe("Peer transceiver duzeni", () => {
  it("impolite taraf dort transceiver'i sabit sirada acar", () => {
    const { pc } = kur(false);
    expect(pc.transceivers.map((t) => t.kind)).toEqual(["audio", "video", "video", "audio"]);
    expect(SLOT_ORDER).toEqual(["mic", "cam", "screenVideo", "screenAudio"]);
  });

  it("uzak track transceiver indeksinden yuvaya eslenir", () => {
    const { pc, track } = kur(false);
    const sahteTrack = { kind: "video" } as MediaStreamTrack;
    pc.ontrack!({ transceiver: pc.transceivers[2], track: sahteTrack });
    expect(track).toEqual([["screenVideo", sahteTrack]]);
  });

  it("setTrack dogru sender'a replaceTrack cagirir", () => {
    const { pc, peer } = kur(false);
    const t = { kind: "audio" } as MediaStreamTrack;
    peer.setTrack("mic", t);
    expect(pc.transceivers[0].sender.replaceTrack).toHaveBeenCalledWith(t);
    expect(pc.transceivers[1].sender.replaceTrack).not.toHaveBeenCalled();
  });

  it("polite taraf transceiver ACMAZ", () => {
    const { pc } = kur(true);
    expect(pc.transceivers).toHaveLength(0);
  });

  it("polite taraf offer gelince uzaktan doganlari benimser ve sendrecv yapar", async () => {
    const { pc, peer } = kur(true);
    const t = { kind: "audio" } as MediaStreamTrack;
    peer.setTrack("mic", t);            // sender henuz yok, kuyruga girer
    await peer.handleSignal({ description: { type: "offer", sdp: "uzak" } });

    expect(pc.transceivers).toHaveLength(4);
    expect(pc.transceivers.map((x) => x.direction)).toEqual(
      ["sendrecv", "sendrecv", "sendrecv", "sendrecv"]);
    // Kuyruktaki track benimseme sonrasi uygulanir; aksi halde katilan kisi
    // hic ses gondermez.
    expect(pc.transceivers[0].sender.replaceTrack).toHaveBeenCalledWith(t);
  });
});

describe("Peer perfect negotiation", () => {
  it("impolite tarafta negotiationneeded offer uretir ve yollar", async () => {
    const { pc, gonderilen } = kur(false);
    await pc.onnegotiationneeded!();
    expect(gonderilen[0].description!.type).toBe("offer");
  });

  it("polite taraf baslangic offer'i URETMEZ", async () => {
    const { pc, gonderilen } = kur(true);
    await pc.onnegotiationneeded!();
    expect(gonderilen).toHaveLength(0);
  });

  it("ice adayi yollanir", () => {
    const { pc, gonderilen } = kur(false);
    pc.onicecandidate!({ candidate: { candidate: "aday" } });
    expect(gonderilen[0].candidate).toEqual({ candidate: "aday" });
  });

  it("sakin durumda gelen offer cevaplanir", async () => {
    const { peer, gonderilen } = kur(false);
    await peer.handleSignal({ description: { type: "offer", sdp: "uzak" } });
    expect(gonderilen.at(-1)!.description!.type).toBe("answer");
  });

  it("impolite taraf cakisan offer'i yok sayar", async () => {
    const { pc, peer, gonderilen } = kur(false);
    pc.signalingState = "have-local-offer";   // kendi offer'im ucusta
    await peer.handleSignal({ description: { type: "offer", sdp: "uzak" } });
    expect(gonderilen).toHaveLength(0);
    expect(pc.remoteDescription).toBeNull();
  });

  it("polite taraf cakisan offer'i kabul edip cevaplar", async () => {
    const { pc, peer, gonderilen } = kur(true);
    pc.signalingState = "have-local-offer";
    await peer.handleSignal({ description: { type: "offer", sdp: "uzak" } });
    expect(pc.remoteDescription).toEqual({ type: "offer", sdp: "uzak" });
    expect(gonderilen.at(-1)!.description!.type).toBe("answer");
  });

  it("answer uygulanir, cevap uretilmez", async () => {
    const { pc, peer, gonderilen } = kur(true);
    pc.signalingState = "have-local-offer";
    await peer.handleSignal({ description: { type: "answer", sdp: "cevap" } });
    expect(pc.remoteDescription!.type).toBe("answer");
    expect(gonderilen).toHaveLength(0);
  });

  it("aday eklenir", async () => {
    const { pc, peer } = kur(true);
    await peer.handleSignal({ candidate: { candidate: "a1" } });
    expect(pc.eklenenAdaylar).toEqual([{ candidate: "a1" }]);
  });

  it("yok sayilan offer'in adaylari hata firlatmaz", async () => {
    const { pc, peer } = kur(false);
    pc.signalingState = "have-local-offer";
    await peer.handleSignal({ description: { type: "offer", sdp: "uzak" } });
    pc.addIceCandidate = async () => { throw new Error("bilinmeyen ufc"); };
    await expect(peer.handleSignal({ candidate: { candidate: "gec" } })).resolves.toBeUndefined();
  });

  it("close baglantiyi kapatir ve dinleyicileri temizler", () => {
    const { pc, peer } = kur(true);
    peer.close();
    expect(pc.kapandi).toBe(true);
    expect(pc.ontrack).toBeNull();
    expect(pc.onnegotiationneeded).toBeNull();
  });
});
