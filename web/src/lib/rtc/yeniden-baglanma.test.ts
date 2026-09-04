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
  restartIce = vi.fn(() => { this.onnegotiationneeded?.(); });
  close() { this.kapandi = true; }
}

function sahteTrack(kind: "audio" | "video") {
  return { kind, enabled: true, stop: vi.fn(), addEventListener: vi.fn() } as unknown as MediaStreamTrack;
}

/** Connection'in VoiceSession'a bakan yuzu; kopus/geri donus tetiklenebilir. */
function kur() {
  const gonderilen: Array<{ t: string }> = [];
  const conn = {
    send: (e: { t: string }) => gonderilen.push(e),
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
    createAudioContext: () => null,
    fetchImpl: vi.fn(async () => Response.json({ iceServers: [] })) as unknown as typeof fetch,
  });
  return { session, conn, gonderilen, pcler };
}

const uye = (userId: string) => ({
  userId, muted: false, deafened: false, camera: false, screen: false, screenAudio: false,
});

beforeEach(() => resetVoice());
afterEach(() => resetVoice());

describe("sinyal kanali kopunca", () => {
  it("olu sokete voice.leave gondermez", async () => {
    const { session, conn, gonderilen } = kur();
    voice.members = [uye("u2")];
    await session.join();
    gonderilen.length = 0;

    conn.onDisconnect!();
    expect(gonderilen.map((e) => e.t)).not.toContain("voice.leave");
  });

  /** Sizinti testi: eski mesh kapanmadan yenisi yazilirsa PC'ler acik kalirdi. */
  it("yeniden katilimda eski baglantilar sizmaz", async () => {
    vi.useFakeTimers();
    try {
      const { session, conn, pcler } = kur();
      voice.members = [uye("u1"), uye("u2")];
      await session.join();
      const eski = pcler[0];

      conn.onDisconnect!();
      await vi.advanceTimersByTimeAsync(60_000);   // tolerans dolsun
      resetVoice();
      voice.members = [uye("u1"), uye("u2")];
      await session.join();

      expect(eski.kapandi).toBe(true);
      expect(pcler).toHaveLength(2);
      expect(pcler[1].kapandi).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("yeniden baglanma", () => {
  it("kullanici kendi ciktiysa geri katilmaz", async () => {
    const { session, conn, gonderilen } = kur();
    voice.members = [uye("u2")];
    await session.join();
    session.leave();

    conn.onDisconnect!();
    resetVoice();
    gonderilen.length = 0;

    conn.onReconnect!();
    await new Promise((r) => setTimeout(r, 20));
    expect(gonderilen.map((e) => e.t)).not.toContain("voice.join");
  });

  /** Kopmadan once susturulmus mikrofon geri donuste ACIK olmamali. */
  it("mute durumu bastan katilimda korunur", async () => {
    vi.useFakeTimers();
    try {
      const { session, conn } = kur();
      voice.members = [uye("u2")];
      await session.join();
      session.setMuted(true);

      conn.onDisconnect!();
      await vi.advanceTimersByTimeAsync(60_000);   // tolerans dolsun
      resetVoice();
      voice.members = [uye("u2")];

      conn.onReconnect!();
      await vi.waitFor(() => expect(voice.joined).toBe(true), { interval: 1 });
      expect(voice.muted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * Ses P2P akar; sinyal kanalinin bir saniyeligine gitmesi sesi kesmemeli.
 * Mesh'i kopus anINDA yikarsak her ag dalgalanmasinda konusma kesilir.
 */
describe("kisa kopma toleransi", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("kopus aninda peer baglantilari kapanmaz", async () => {
    const { session, conn, pcler } = kur();
    voice.members = [uye("u1"), uye("u2")];
    await session.join();

    conn.onDisconnect!();
    expect(pcler[0].kapandi).toBe(false);
    expect(voice.joined).toBe(true);
  });

  it("kopusta uzak track'ler silinmez", async () => {
    const { session, conn } = kur();
    voice.members = [uye("u1"), uye("u2")];
    await session.join();
    voice.remote.set("u1", { mic: null, cam: null, screenVideo: null, screenAudio: null });

    conn.onDisconnect!();
    expect(voice.remote.has("u1")).toBe(true);
  });

  it("store temizligini oturum devraldi diye bildirir", async () => {
    const { session, conn } = kur();
    voice.members = [uye("u2")];
    await session.join();
    expect(conn.onDisconnect!()).toBe(true);
  });

  it("hizli geri donuste mesh korunur, sunucuya yeniden duyurulur", async () => {
    const { session, conn, pcler, gonderilen } = kur();
    voice.members = [uye("u1"), uye("u2")];
    await session.join();
    const pcSayisi = pcler.length;

    conn.onDisconnect!();
    vi.advanceTimersByTime(2000);
    conn.onReconnect!();
    await vi.advanceTimersByTimeAsync(0);

    // Yeni socket'te inVoice bastan false; kanal yeniden duyurulmali.
    expect(gonderilen.map((e) => e.t)).toContain("voice.join");
    // Sunucu katilimda bayraklari sifirlar; mevcut durum geri yazilmali.
    expect(gonderilen.map((e) => e.t)).toContain("voice.state");
    // Ama baglantilar ayni: ses hic kesilmedi.
    expect(pcler).toHaveLength(pcSayisi);
    expect(pcler[0].kapandi).toBe(false);
  });

  it("tolerans dolarsa gercekten birakir", async () => {
    const { session, conn, pcler } = kur();
    voice.members = [uye("u1"), uye("u2")];
    await session.join();

    conn.onDisconnect!();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(pcler[0].kapandi).toBe(true);
    expect(voice.joined).toBe(false);
  });

  it("tolerans dolduktan sonra geri donuste bastan katilir", async () => {
    const { session, conn, pcler, gonderilen } = kur();
    voice.members = [uye("u1"), uye("u2")];
    await session.join();

    conn.onDisconnect!();
    await vi.advanceTimersByTimeAsync(60_000);
    gonderilen.length = 0;
    voice.members = [uye("u1"), uye("u2")];

    conn.onReconnect!();
    await vi.waitFor(() => expect(voice.joined).toBe(true));
    expect(gonderilen.map((e) => e.t)).toContain("voice.join");
    expect(pcler.length).toBeGreaterThan(1);
  });
});
