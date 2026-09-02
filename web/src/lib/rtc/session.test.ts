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
    // Node'da AudioContext yok; konusma gostergesi bu testlerin konusu degil.
    createAudioContext: () => null,
    fetchImpl: vi.fn(async () => Response.json({
      iceServers: [{ urls: ["stun:stun.cloudflare.com:3478"] }],
    })) as unknown as typeof fetch,
  });
  return { session, conn, gonderilen, pcler, mikrofon };
}

/** kur() ile ayni, ama getDisplayMedia gercek bir track doner. */
function kurEkranli() {
  const gonderilen: unknown[] = [];
  const conn = {
    send: (e: unknown) => gonderilen.push(e),
    onVoiceMembers: null as ((m: unknown[]) => void) | null,
    onSignal: null as ((f: string, d: unknown) => void) | null,
  };
  const mikrofon = sahteTrack("audio");
  const ekran = sahteTrack("video");
  const deps: MediaDeps = {
    getUserMedia: vi.fn(async () => ({
      getAudioTracks: () => [mikrofon],
      getVideoTracks: () => [sahteTrack("video")],
      getTracks: () => [mikrofon],
    } as unknown as MediaStream)),
    getDisplayMedia: vi.fn(async () => ({
      getVideoTracks: () => [ekran],
      getAudioTracks: () => [],
      getTracks: () => [ekran],
    } as unknown as MediaStream)),
  };
  const session = new VoiceSession({
    conn: conn as never, selfId: "u2", apiUrl: "https://api.test", token: "tok",
    media: new LocalMedia(deps),
    createPeerConnection: () => new SahtePC() as unknown as RTCPeerConnection,
    createAudioContext: () => null,
    fetchImpl: vi.fn(async () => Response.json({ iceServers: [] })) as unknown as typeof fetch,
  });
  return { session, conn, gonderilen, ekran };
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

describe("VoiceSession ekran paylasimi", () => {
  it("paylasim baslayinca bayraklar yayilir", async () => {
    const { session, gonderilen } = kur();
    await session.join();
    const s = session as unknown as { media: { startScreen: unknown } };
    s.media.startScreen = vi.fn(async () => ({ video: sahteTrack("video"), audio: sahteTrack("audio") }));
    await session.startScreen();
    expect(voice.screen).toBe(true);
    expect(voice.screenAudio).toBe(true);
    expect(gonderilen.at(-1)).toMatchObject({ screen: true, screenAudio: true });
  });

  it("Chromium cubugundan durdurulunca ended yakalanir ve durum yayilir", async () => {
    const { session, gonderilen } = kur();
    await session.join();
    const video = sahteTrack("video");
    const dinleyiciler: Array<() => void> = [];
    (video as unknown as { addEventListener: unknown }).addEventListener =
      (tip: string, fn: () => void) => { if (tip === "ended") dinleyiciler.push(fn); };
    const s = session as unknown as { media: { startScreen: unknown } };
    s.media.startScreen = vi.fn(async () => ({ video, audio: null }));

    await session.startScreen();
    expect(voice.screen).toBe(true);

    dinleyiciler.forEach((fn) => fn());   // kullanici Chromium cubuguna basti
    expect(voice.screen).toBe(false);
    expect(gonderilen.at(-1)).toMatchObject({ screen: false, screenAudio: false });
  });

  it("kullanici native secicide vazgecerse hata gosterilmez", async () => {
    const { session } = kur();
    await session.join();
    const s = session as unknown as { media: { startScreen: unknown } };
    s.media.startScreen = vi.fn(async () => {
      throw new DOMException("iptal", "NotAllowedError");
    });
    await session.startScreen();
    expect(voice.screen).toBe(false);
    expect(voice.error).toBeNull();
  });
});

describe("VoiceSession baglanti durumu", () => {
  it("failed durumu kullanici basina store'a yazilir", async () => {
    const { session, conn, pcler } = kur();
    await session.join();
    conn.onVoiceMembers!([{ userId: "u1" }, { userId: "u2" }, { userId: "u3" }]);

    // u1 icin acilan baglanti coker.
    pcler[0].connectionState = "failed";
    pcler[0].onconnectionstatechange!();

    expect([...voice.connection.values()]).toContain("failed");
    // Digeri etkilenmez: uyari yalnizca kopan kisinin yaninda cikmali.
    expect([...voice.connection.values()].filter((d) => d === "failed")).toHaveLength(1);
  });

  it("uye ayrilinca durum kaydi temizlenir", async () => {
    const { session, conn, pcler } = kur();
    await session.join();
    conn.onVoiceMembers!([{ userId: "u1" }, { userId: "u2" }]);
    pcler[0].connectionState = "failed";
    pcler[0].onconnectionstatechange!();
    expect(voice.connection.size).toBe(1);

    conn.onVoiceMembers!([{ userId: "u2" }]);
    expect(voice.connection.size).toBe(0);
  });

  it("leave tum durum kayitlarini siler", async () => {
    const { session, conn, pcler } = kur();
    await session.join();
    conn.onVoiceMembers!([{ userId: "u1" }, { userId: "u2" }]);
    pcler[0].connectionState = "connected";
    pcler[0].onconnectionstatechange!();
    session.leave();
    expect(voice.connection.size).toBe(0);
  });
});

describe("voice.local yerel track yuzeyi", () => {
  it("baslangicta iki yuva da bos", () => {
    expect(voice.local).toEqual({ cam: null, screenVideo: null });
  });

  it("kamera acilinca local.cam dolar", async () => {
    const { session } = kur();
    await session.join();
    await session.setCamera(true);
    expect(voice.local.cam).not.toBeNull();
    expect(voice.local.cam?.kind).toBe("video");
  });

  it("kamera kapaninca local.cam bosalir", async () => {
    const { session } = kur();
    await session.join();
    await session.setCamera(true);
    await session.setCamera(false);
    expect(voice.local.cam).toBeNull();
  });

  it("kamera acilirken hata olursa local.cam bos kalir", async () => {
    const gonderilen: unknown[] = [];
    const conn = {
      send: (e: unknown) => gonderilen.push(e),
      onVoiceMembers: null, onSignal: null,
    };
    const mikrofon = sahteTrack("audio");
    let ilkCagri = true;
    const deps: MediaDeps = {
      getUserMedia: vi.fn(async () => {
        // Ilk cagri mikrofon (join), ikinci cagri kamera: kamera reddedilsin.
        if (ilkCagri) {
          ilkCagri = false;
          return { getAudioTracks: () => [mikrofon], getVideoTracks: () => [], getTracks: () => [mikrofon] } as unknown as MediaStream;
        }
        throw new Error("NotAllowedError");
      }),
      getDisplayMedia: vi.fn(),
    };
    const session = new VoiceSession({
      conn: conn as never, selfId: "u2", apiUrl: "https://api.test", token: "tok",
      media: new LocalMedia(deps),
      createPeerConnection: () => new SahtePC() as unknown as RTCPeerConnection,
      createAudioContext: () => null,
      fetchImpl: vi.fn(async () => Response.json({ iceServers: [] })) as unknown as typeof fetch,
    });
    await session.join();
    await session.setCamera(true);
    expect(voice.camera).toBe(false);
    expect(voice.local.cam).toBeNull();
  });

  it("ekran paylasimi baslayinca local.screenVideo dolar", async () => {
    const { session } = kurEkranli();
    await session.join();
    await session.startScreen();
    expect(voice.local.screenVideo).not.toBeNull();
  });

  it("ekran paylasimi durunca local.screenVideo bosalir", async () => {
    const { session } = kurEkranli();
    await session.join();
    await session.startScreen();
    session.stopScreen();
    expect(voice.local.screenVideo).toBeNull();
  });

  it("leave iki yuvayi da temizler", async () => {
    const { session } = kurEkranli();
    await session.join();
    await session.setCamera(true);
    await session.startScreen();
    session.leave();
    expect(voice.local).toEqual({ cam: null, screenVideo: null });
  });

  it("her yazimda yeni nesne atanir", async () => {
    // Ayni referansi tekrar yazmak Svelte abonelerini uyandirmaz.
    const { session } = kur();
    await session.join();
    const once = voice.local;
    await session.setCamera(true);
    expect(voice.local).not.toBe(once);
  });
});

/** Dinleyicileri saklayan track: "mute"/"ended" testte tetiklenebilir. */
function izliTrack(kind: "audio" | "video" = "video", muted = false) {
  const dinleyiciler = new Map<string, Array<() => void>>();
  const t = {
    kind, enabled: true, muted, stop: vi.fn(),
    addEventListener(ad: string, fn: () => void) {
      const liste = dinleyiciler.get(ad) ?? [];
      liste.push(fn);
      dinleyiciler.set(ad, liste);
    },
  };
  return {
    track: t as unknown as MediaStreamTrack,
    ates(ad: string) { for (const fn of dinleyiciler.get(ad) ?? []) fn(); },
  };
}

describe("VoiceSession uzak track yonetimi", () => {
  /** u1 ile baglanti kurar ve verilen yuvaya track dusurur. */
  async function baglaVeGonder(slotIndex: number, muted = false) {
    const { session, conn, pcler } = kur();
    await session.join();
    conn.onVoiceMembers!([{ userId: "u1" }, { userId: "u2" }]);
    const pc = pcler[0];
    const { track, ates } = izliTrack("video", muted);
    pc.ontrack!({ transceiver: pc.transceivers[slotIndex], track });
    return { session, ates, track };
  }

  it("uzak kamera track'i geldigi anda store'a yazilir", async () => {
    const { track } = await baglaVeGonder(1);
    expect(voice.remote.get("u1")?.cam).toBe(track);
  });

  it("track muted gelse bile store'a yazilir", async () => {
    // Gorunurluk artik VoiceMember.camera bayragindan geliyor; store yalnizca
    // "bu yuvada bir track var mi" sorusunu cevaplar.
    const { track } = await baglaVeGonder(1, true);
    expect(voice.remote.get("u1")?.cam).toBe(track);
  });

  it("mute olayi track'i store'dan DUSURMEZ", async () => {
    // Chrome mute'u gecici paket kaybinda da atesliyor. Yuvayi null'larsak
    // <video> DOM'dan sokuluyor ve kare siyaha dusuyor (titreme hatasi).
    const { ates } = await baglaVeGonder(1);
    const once = voice.remote.get("u1")?.cam;
    ates("mute");
    expect(voice.remote.get("u1")?.cam).toBe(once);
  });

  it("ended olayi yuvayi bosaltir", async () => {
    const { ates } = await baglaVeGonder(1);
    ates("ended");
    expect(voice.remote.get("u1")?.cam).toBeNull();
  });
});
