import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Connection } from "./connection.svelte";
import { resetVoice, voice } from "./voice.svelte";

class SahteSoket {
  static sonuncu: SahteSoket;
  gonderilen: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(public url: string) { SahteSoket.sonuncu = this; }
  send(d: string) { this.gonderilen.push(d); }
  close() { this.onclose?.(); }
}

const UYE = {
  userId: "u2", muted: false, deafened: false,
  camera: false, screen: false, screenAudio: false,
};

beforeEach(() => {
  vi.stubGlobal("WebSocket", SahteSoket);
  vi.useFakeTimers();
  resetVoice();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ses olaylari", () => {
  it("hello icindeki ses listesi store'a yazilir", () => {
    const c = new Connection("wss://x/ws", "tok");
    SahteSoket.sonuncu.onopen!();
    SahteSoket.sonuncu.onmessage!({ data: JSON.stringify({
      t: "hello", me: { id: "u1", username: "n", displayName: "N" },
      members: [], recentMessages: [], reactions: [], online: [], voiceMembers: [UYE],
    }) });
    expect(voice.members).toEqual([UYE]);
    c.close();
  });

  it("voice.members store'u gunceller", () => {
    const c = new Connection("wss://x/ws", "tok");
    SahteSoket.sonuncu.onopen!();
    SahteSoket.sonuncu.onmessage!({ data: JSON.stringify({ t: "voice.members", members: [UYE] }) });
    expect(voice.members.map((m) => m.userId)).toEqual(["u2"]);
    c.close();
  });

  it("voice.members geri cagrisi calisir", () => {
    const c = new Connection("wss://x/ws", "tok");
    const gorulen: string[][] = [];
    c.onVoiceMembers = (m) => gorulen.push(m.map((x) => x.userId));
    SahteSoket.sonuncu.onopen!();
    SahteSoket.sonuncu.onmessage!({ data: JSON.stringify({ t: "voice.members", members: [UYE] }) });
    expect(gorulen).toEqual([["u2"]]);
    c.close();
  });

  it("signal geri cagrisi from ve data ile calisir", () => {
    const c = new Connection("wss://x/ws", "tok");
    const gelen: unknown[] = [];
    c.onSignal = (from, data) => gelen.push([from, data]);
    SahteSoket.sonuncu.onopen!();
    SahteSoket.sonuncu.onmessage!({ data: JSON.stringify({
      t: "signal", from: "u2", data: { candidate: null },
    }) });
    expect(gelen).toEqual([["u2", { candidate: null }]]);
    c.close();
  });

  it("ses_dolu hatasi store'a yazilir", () => {
    const c = new Connection("wss://x/ws", "tok");
    SahteSoket.sonuncu.onopen!();
    SahteSoket.sonuncu.onmessage!({ data: JSON.stringify({
      t: "error", code: "ses_dolu", message: "Ses kanalı dolu (en fazla 4 kişi).",
    }) });
    expect(voice.error).toBe("Ses kanalı dolu (en fazla 4 kişi).");
    expect(voice.joined).toBe(false);
    c.close();
  });

  it("baglanti kopunca ses durumu sifirlanir", () => {
    const c = new Connection("wss://x/ws", "tok");
    const ws = SahteSoket.sonuncu;
    ws.onopen!();
    ws.onmessage!({ data: JSON.stringify({ t: "voice.members", members: [UYE] }) });
    voice.joined = true;

    ws.close();
    expect(voice.joined).toBe(false);
    expect(voice.members).toEqual([]);
    c.close();
  });
});
