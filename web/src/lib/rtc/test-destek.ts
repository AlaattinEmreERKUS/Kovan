import { vi } from "vitest";
import { VoiceSession } from "./session";
import { LocalMedia, type MediaDeps } from "./media";

/**
 * MikrofonIsleyici ve gain.ts track'i sarmak icin `new MediaStream([t])`
 * cagiriyor; node'da bu global yok. Mevcut session testleri sorunu
 * `createAudioContext: () => null` vererek dolaniyordu, ama cihaz testleri
 * gercek bir kapi zinciri kurmak zorunda. attach.test.ts ile ayni cozum.
 */
class SahteStream {
  constructor(private parcalar: MediaStreamTrack[] = []) {}
  getAudioTracks() { return this.parcalar; }
  getVideoTracks() { return []; }
  getTracks() { return this.parcalar; }
}
(globalThis as { MediaStream?: unknown }).MediaStream ??= SahteStream;

/**
 * gain.ts'teki `storage: Storage = localStorage` varsayilani node'da ANINDA
 * patlar (varsayilan parametre, cagrilmasa da degerlendirilir). Oturum ses
 * mikserlerini join() icinde kurdugu icin bu yol kacinilmaz.
 */
const bellekDepo = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage ??= {
  getItem: (k: string) => bellekDepo.get(k) ?? null,
  setItem: (k: string, v: string) => void bellekDepo.set(k, v),
  removeItem: (k: string) => void bellekDepo.delete(k),
  clear: () => bellekDepo.clear(),
  key: (i: number) => [...bellekDepo.keys()][i] ?? null,
  get length() { return bellekDepo.size; },
};

export class SahtePC {
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
  addTransceiver = vi.fn((kind: string) => {
    const t = { kind, sender: { replaceTrack: vi.fn(async () => {}) } };
    this.transceivers.push(t);
    return t;
  });
  getTransceivers() { return this.transceivers; }
  async setLocalDescription() {}
  async setRemoteDescription() {}
  async addIceCandidate() {}
  restartIce = vi.fn();
  close() { this.kapandi = true; }
}

/**
 * `setSinkId` Chromium 110+ eklentisi; TypeScript'in AudioContext tipinde yok.
 * Testler sahte ctx uzerinde onu dogrudan okuyabilsin diye tip genisletilir.
 */
export type SahteCtx = AudioContext & { setSinkId: ReturnType<typeof vi.fn> };

/** MikrofonIsleyici gercek AudioContext ister; node'da sahtesi verilir. */
export function sahteCtx(): SahteCtx {
  const dugum = () => ({
    connect: vi.fn(), disconnect: vi.fn(),
    gain: { value: 1, setTargetAtTime: vi.fn() },
    getFloatTimeDomainData: vi.fn(), fftSize: 2048,
  });
  return {
    currentTime: 0,
    destination: {},
    state: "running",
    setSinkId: vi.fn(async () => {}),
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    createMediaStreamSource: vi.fn(dugum),
    createAnalyser: vi.fn(dugum),
    createGain: vi.fn(dugum),
    createOscillator: vi.fn(() => ({ ...dugum(), start: vi.fn(), stop: vi.fn(), frequency: { value: 0 } })),
    createMediaStreamDestination: vi.fn(() => ({
      ...dugum(),
      stream: { getAudioTracks: () => [{ kind: "audio", stop: vi.fn(), addEventListener: vi.fn() }] },
    })),
  } as unknown as SahteCtx;
}

function sahteTrack(etiket: string) {
  return {
    kind: "audio", enabled: true, readyState: "live", label: etiket,
    stop: vi.fn(), addEventListener: vi.fn(),
  } as unknown as MediaStreamTrack;
}

export function kur() {
  // Cihaz tercihi kalici: bir testin yazdigi secim digerine sizmasin.
  bellekDepo.clear();
  const conn = {
    send: vi.fn(),
    onVoiceMembers: null as ((m: unknown[]) => void) | null,
    onSignal: null as ((f: string, d: unknown) => void) | null,
    onDisconnect: null as (() => void) | null,
    onReconnect: null as (() => void) | null,
  };
  const uretilen: MediaStreamTrack[] = [];
  const deps: MediaDeps = {
    getUserMedia: vi.fn(async () => {
      const t = sahteTrack(`mik-${uretilen.length}`);
      uretilen.push(t);
      return {
        getAudioTracks: () => [t], getVideoTracks: () => [], getTracks: () => [t],
      } as unknown as MediaStream;
    }),
    getDisplayMedia: vi.fn(),
  };
  const pcler: SahtePC[] = [];
  const ctx = sahteCtx();
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
    createAudioContext: () => ctx,
    fetchImpl: vi.fn(async () => Response.json({ iceServers: [] })) as unknown as typeof fetch,
  });
  return { session, conn, deps, pcler, ctx, uretilen };
}

export const uye = (userId: string) => ({
  userId, muted: false, deafened: false, camera: false, screen: false, screenAudio: false,
});
