import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VoiceSession } from "./session";
import { LocalMedia, type MediaDeps } from "./media";
import { resetVoice, voice } from "../voice.svelte";

/**
 * Sunucunun urettigi TURN credential'i bir saat yasar (server/src/turn.ts,
 * TTL = 3600). Oturum boyunca bir kez alinip sabitlenirse saatler suren bir
 * konusmada credential oturumun ALTINDA olur: o andan sonra restartIce()
 * relay adayi toplayamaz ve simetrik NAT arkasindaki kullanici geri
 * baglanamaz. Sessizdir, cunku STUN adaylari toplanmaya devam eder.
 */
class SahtePC {
  signalingState: RTCSignalingState = "stable";
  connectionState: RTCPeerConnectionState = "new";
  localDescription = null;
  transceivers: Array<{ kind: string; sender: { replaceTrack: ReturnType<typeof vi.fn> } }> = [];
  kapandi = false;
  onnegotiationneeded: (() => void) | null = null;
  onicecandidate: ((e: unknown) => void) | null = null;
  ontrack: ((e: unknown) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  setConfiguration = vi.fn();
  addTransceiver(kind: string) {
    const t = { kind, sender: { replaceTrack: vi.fn(async () => {}) } };
    this.transceivers.push(t);
    return t;
  }
  getTransceivers() { return this.transceivers; }
  async setLocalDescription() {}
  async setRemoteDescription() {}
  async addIceCandidate() {}
  restartIce = vi.fn();
  close() { this.kapandi = true; }
}

function sahteTrack(kind: "audio" | "video") {
  return { kind, enabled: true, stop: vi.fn(), addEventListener: vi.fn() } as unknown as MediaStreamTrack;
}

const SUNUCU = (etiket: string) => [{ urls: "turn:t.test", username: etiket, credential: etiket }];

function kur() {
  const conn = {
    send: vi.fn(),
    onVoiceMembers: null as ((m: unknown[]) => void) | null,
    onSignal: null as ((f: string, d: unknown) => void) | null,
    onDisconnect: null as (() => void) | null,
    onReconnect: null as (() => void) | null,
  };
  const mikrofon = sahteTrack("audio");
  const deps: MediaDeps = {
    getUserMedia: vi.fn(async () => ({
      getAudioTracks: () => [mikrofon],
      getVideoTracks: () => [sahteTrack("video")],
      getTracks: () => [mikrofon],
    } as unknown as MediaStream)),
    getDisplayMedia: vi.fn(),
  };
  const pcler: SahtePC[] = [];
  const yapilandirmalar: RTCConfiguration[] = [];
  let sayac = 0;
  const fetchImpl = vi.fn(async () =>
    Response.json({ iceServers: SUNUCU(`cred${++sayac}`) })) as unknown as typeof fetch;
  const session = new VoiceSession({
    conn: conn as never,
    selfId: "u2",
    apiUrl: "https://api.test",
    token: "tok",
    media: new LocalMedia(deps),
    createPeerConnection: (cfg) => {
      yapilandirmalar.push(cfg);
      const pc = new SahtePC();
      pcler.push(pc);
      return pc as unknown as RTCPeerConnection;
    },
    createAudioContext: () => null,
    fetchImpl,
  });
  return { session, conn, pcler, fetchImpl, yapilandirmalar };
}

const uye = (userId: string) => ({
  userId, muted: false, deafened: false, camera: false, screen: false, screenAudio: false,
});

beforeEach(() => { vi.useFakeTimers(); resetVoice(); });
afterEach(() => { vi.useRealTimers(); resetVoice(); });

describe("TURN credential tazeleme", () => {
  it("credential omru dolmadan yeniden alinir", async () => {
    const { session, fetchImpl } = kur();
    voice.members = [uye("u1"), uye("u2")];
    await session.join();
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(46 * 60_000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("acik baglantilarin yapilandirmasi guncellenir", async () => {
    const { session, pcler } = kur();
    voice.members = [uye("u1"), uye("u2")];
    await session.join();

    await vi.advanceTimersByTimeAsync(46 * 60_000);
    expect(pcler[0].setConfiguration).toHaveBeenCalledWith({ iceServers: SUNUCU("cred2") });
  });

  it("tazelemeden sonra kurulan peer yeni credential'i alir", async () => {
    const { session, conn, yapilandirmalar } = kur();
    voice.members = [uye("u1"), uye("u2")];
    await session.join();

    await vi.advanceTimersByTimeAsync(46 * 60_000);
    conn.onVoiceMembers!([uye("u1"), uye("u2"), uye("u3")]);

    expect(yapilandirmalar[yapilandirmalar.length - 1].iceServers).toEqual(SUNUCU("cred2"));
  });

  /** Gecici bir aglama TURN'u dusurup herkesi STUN'a mahkum etmemeli. */
  it("tazeleme basarisiz olursa eski credential korunur", async () => {
    const { session, pcler, fetchImpl } = kur();
    voice.members = [uye("u1"), uye("u2")];
    await session.join();
    (fetchImpl as unknown as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("ag yok"));

    await vi.advanceTimersByTimeAsync(46 * 60_000);
    expect(pcler[0].setConfiguration).not.toHaveBeenCalled();
  });

  it("kanaldan cikinca tazeleme durur", async () => {
    const { session, fetchImpl } = kur();
    voice.members = [uye("u1"), uye("u2")];
    await session.join();
    session.leave();

    await vi.advanceTimersByTimeAsync(3 * 60 * 60_000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
