import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Connection } from "./connection.svelte";
import { store } from "./store.svelte";

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

beforeEach(() => {
  vi.stubGlobal("WebSocket", SahteSoket);
  vi.useFakeTimers();
  // store modul seviyesinde tek nesne; testler arasi sizinti olmasin.
  store.me = null;
  store.members = [];
  store.messages = [];
  store.online.clear();
  store.reactions.clear();
  store.typingUserIds.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Connection", () => {
  it("typing 3 saniyede bir kez gonderir", () => {
    const c = new Connection("wss://x/ws", "tok");
    SahteSoket.sonuncu.onopen!();

    c.typing();
    c.typing();
    c.typing();
    expect(SahteSoket.sonuncu.gonderilen.filter((s) => s.includes("typing"))).toHaveLength(1);

    vi.advanceTimersByTime(3001);
    c.typing();
    expect(SahteSoket.sonuncu.gonderilen.filter((s) => s.includes("typing"))).toHaveLength(2);
    c.close();
  });

  it("kopunca ustel backoff ile yeniden baglanir", () => {
    const c = new Connection("wss://x/ws", "tok");
    const ilk = SahteSoket.sonuncu;
    ilk.onopen!();
    ilk.close();

    vi.advanceTimersByTime(999);
    expect(SahteSoket.sonuncu).toBe(ilk); // 1sn dolmadan denemez

    vi.advanceTimersByTime(2);
    expect(SahteSoket.sonuncu).not.toBe(ilk); // yeni soket acildi
    c.close();
  });

  it("backoff ustel buyur ve tavanda durur", () => {
    const c = new Connection("wss://x/ws", "tok");
    let onceki = SahteSoket.sonuncu;
    onceki.onopen!();

    // 1sn, 2sn, 4sn, 8sn: her kopusta bekleme iki katina cikmali
    for (const bekleme of [1000, 2000, 4000, 8000]) {
      onceki.close();
      vi.advanceTimersByTime(bekleme - 1);
      expect(SahteSoket.sonuncu, `${bekleme}ms dolmadan baglandi`).toBe(onceki);
      vi.advanceTimersByTime(2);
      expect(SahteSoket.sonuncu, `${bekleme}ms sonra baglanmadi`).not.toBe(onceki);
      onceki = SahteSoket.sonuncu;
    }
    c.close();
  });

  it("yeniden baglaninca son mesaj idsi ile sync ister", () => {
    const c = new Connection("wss://x/ws", "tok");
    const ilk = SahteSoket.sonuncu;
    ilk.onopen!();
    ilk.onmessage!({ data: JSON.stringify({
      t: "hello", me: { id: "u1", username: "n", displayName: "N" },
      members: [], recentMessages: [{ id: 7, authorId: "u1", content: "x", createdAt: 1 }],
      reactions: [], online: ["u1"], voiceMembers: [],
    }) });

    ilk.close();
    vi.advanceTimersByTime(1001);
    SahteSoket.sonuncu.onopen!();

    const sync = SahteSoket.sonuncu.gonderilen.find((s) => s.includes("sync"));
    expect(JSON.parse(sync!)).toEqual({ t: "sync", lastMessageId: 7 });
    c.close();
  });

  it("ilk acilista sync istenmez", () => {
    const c = new Connection("wss://x/ws", "tok");
    SahteSoket.sonuncu.onopen!();
    expect(SahteSoket.sonuncu.gonderilen.find((s) => s.includes("sync"))).toBeUndefined();
    c.close();
  });

  it("ayni mesaj iki kez gelirse bir kez saklanir", () => {
    const c = new Connection("wss://x/ws", "tok");
    const ws = SahteSoket.sonuncu;
    ws.onopen!();
    const mesaj = { id: 3, authorId: "u1", content: "tek", createdAt: 1 };
    ws.onmessage!({ data: JSON.stringify({ t: "msg.new", message: mesaj }) });
    ws.onmessage!({ data: JSON.stringify({ t: "sync.result", messages: [mesaj] }) });
    expect(store.messages).toHaveLength(1);
    c.close();
  });

  it("close sonrasi yeniden baglanmaz", () => {
    const c = new Connection("wss://x/ws", "tok");
    const ilk = SahteSoket.sonuncu;
    ilk.onopen!();
    c.close();
    vi.advanceTimersByTime(60000);
    expect(SahteSoket.sonuncu).toBe(ilk);
  });
});
