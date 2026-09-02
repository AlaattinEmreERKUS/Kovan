import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VoiceSession } from "./session";
import { LocalMedia, type MediaDeps } from "./media";
import { resetVoice, voice } from "../voice.svelte";

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
  addTransceiver(kind: string) {
    const t = { kind, sender: { replaceTrack: vi.fn(async () => {}) } };
    this.transceivers.push(t);
    return t;
  }
  getTransceivers() { return this.transceivers; }
  async setLocalDescription() {}
  async setRemoteDescription() {}
  async addIceCandidate() {}
  close() { this.kapandi = true; }
}

function sahteTrack(kind: "audio" | "video") {
  return {
    kind, enabled: true, stop: vi.fn(), addEventListener: vi.fn(),
  } as unknown as MediaStreamTrack;
}

function kur() {
  const gonderilen: unknown[] = [];
  const conn = {
    send: (e: unknown) => gonderilen.push(e),
    onVoiceMembers: null as ((m: unknown[]) => void) | null,
    onSignal: null as ((f: string, d: unknown) => void) | null,
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
  const session = new VoiceSession({
    conn: conn as never,
    selfId: "u2",
    apiUrl: "https://api.test",
    token: "tok",
    media: new LocalMedia(deps),
    createPeerConnection: () => {
      const pc = new SahtePC();
      pcler.push(pc);
      return pc as unknown as RTCPeerConnection;
    },
    fetchImpl: vi.fn(async () => Response.json({
      iceServers: [{ urls: ["stun:stun.cloudflare.com:3478"] }],
    })) as unknown as typeof fetch,
  });
  return { session, conn, gonderilen, pcler, mikrofon };
}

beforeEach(() => resetVoice());
afterEach(() => vi.restoreAllMocks());

describe("VoiceSession katilma", () => {
  it("join mikrofonu acar ve voice.join gonderir", async () => {
    const { session, gonderilen } = kur();
    await session.join();
    expect(voice.joined).toBe(true);
    expect(gonderilen).toContainEqual({ t: "voice.join" });
  });

  it("uye listesi gelince kendisi disindaki herkese baglanti acilir", async () => {
    const { session, conn, pcler } = kur();
    await session.join();
    conn.onVoiceMembers!([{ userId: "u1" }, { userId: "u2" }, { userId: "u3" }]);
    expect(pcler).toHaveLength(2);
  });

  it("mikrofon track'i her baglantiya verilir", async () => {
    const { session, conn, pcler, mikrofon } = kur();
    await session.join();
    conn.onVoiceMembers!([{ userId: "u1" }, { userId: "u2" }]);
    // 0. transceiver mic yuvasi.
    expect(pcler[0].transceivers[0].sender.replaceTrack).toHaveBeenCalledWith(mikrofon);
  });

  it("mikrofon izni reddedilirse seste gorunmez ve hata yazilir", async () => {
    const { session, gonderilen } = kur();
    const s = session as unknown as { media: LocalMedia };
    s.media.startMic = vi.fn(async () => { throw new Error("reddedildi"); });
    await session.join();
    expect(voice.joined).toBe(false);
    expect(voice.error).toMatch(/[Mm]ikrofon/);
    expect(gonderilen).not.toContainEqual({ t: "voice.join" });
  });
});

describe("VoiceSession durum degisiklikleri", () => {
  it("setMuted store'u gunceller ve voice.state yayar", async () => {
    const { session, gonderilen } = kur();
    await session.join();
    session.setMuted(true);
    expect(voice.muted).toBe(true);
    expect(gonderilen.at(-1)).toEqual({
      t: "voice.state", muted: true, deafened: false,
      camera: false, screen: false, screenAudio: false,
    });
  });

  it("deafen mikrofonu da kapatir (Discord davranisi)", async () => {
    const { session, gonderilen } = kur();
    await session.join();
    session.setDeafened(true);
    expect(voice.deafened).toBe(true);
    expect(voice.muted).toBe(true);
    expect(gonderilen.at(-1)).toMatchObject({ muted: true, deafened: true });
  });

  it("ayni degeri iki kez yazmak ikinci paketi gondermez (kota)", async () => {
    const { session, gonderilen } = kur();
    await session.join();
    session.setMuted(true);
    const sayi = gonderilen.length;
    session.setMuted(true);
    expect(gonderilen).toHaveLength(sayi);
  });
});

describe("VoiceSession ayrilma", () => {
  it("leave baglantilari kapatir, track'leri durdurur, voice.leave yollar", async () => {
    const { session, conn, gonderilen, pcler, mikrofon } = kur();
    await session.join();
    conn.onVoiceMembers!([{ userId: "u1" }, { userId: "u2" }]);
    session.leave();
    expect(pcler[0].kapandi).toBe(true);
    expect(mikrofon.stop).toHaveBeenCalled();
    expect(voice.joined).toBe(false);
    expect(gonderilen.at(-1)).toEqual({ t: "voice.leave" });
  });

  it("seste degilken gelen uye listesi baglanti acmaz", () => {
    const { conn, pcler } = kur();
    conn.onVoiceMembers!([{ userId: "u1" }, { userId: "u2" }]);
    expect(pcler).toHaveLength(0);
  });
});
