import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { STUN_ONLY, iceServers } from "../src/turn";
import { kayit, reset, stub } from "./helpers";

const SAHTE_YANIT = {
  iceServers: [
    { urls: ["stun:stun.cloudflare.com:3478"] },
    { urls: ["turn:turn.cloudflare.com:3478?transport=udp"], username: "kullanici", credential: "gizli" },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("iceServers", () => {
  it("secret yoksa STUN yedegini dondurur, ag cagrisi yapmaz", async () => {
    const cagrildi = vi.fn();
    vi.stubGlobal("fetch", cagrildi);
    expect(await iceServers({} as never, "u1")).toEqual(STUN_ONLY);
    expect(cagrildi).not.toHaveBeenCalled();
  });

  it("Realtime yanitini oldugu gibi dondurur ve tokeni govdeye koymaz", async () => {
    const sahte = vi.fn(async () => Response.json(SAHTE_YANIT, { status: 201 }));
    vi.stubGlobal("fetch", sahte);

    const sonuc = await iceServers(
      { TURN_KEY_ID: "anahtar1", TURN_KEY_API_TOKEN: "gizli-token" } as never, "u1");

    expect(sonuc).toEqual(SAHTE_YANIT.iceServers);
    const [url, init] = sahte.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://rtc.live.cloudflare.com/v1/turn/keys/anahtar1/credentials/generate-ice-servers");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer gizli-token");
    expect(JSON.parse(init.body as string)).toEqual({ ttl: 3600, customIdentifier: "u1" });
  });

  it("tek nesne donen yanit da diziye normalize edilir", async () => {
    vi.stubGlobal("fetch", async () => Response.json(
      { iceServers: { urls: ["turn:turn.cloudflare.com:3478"], username: "a", credential: "b" } }));
    const sonuc = await iceServers(
      { TURN_KEY_ID: "k", TURN_KEY_API_TOKEN: "t" } as never, "u1");
    expect(sonuc).toHaveLength(1);
    expect(sonuc[0].username).toBe("a");
  });

  it("Realtime hata donerse STUN yedegine duser", async () => {
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 500 }));
    expect(await iceServers({ TURN_KEY_ID: "k", TURN_KEY_API_TOKEN: "t" } as never, "u1"))
      .toEqual(STUN_ONLY);
  });

  it("ag hatasi firlatirsa STUN yedegine duser", async () => {
    vi.stubGlobal("fetch", async () => { throw new Error("ag yok"); });
    expect(await iceServers({ TURN_KEY_ID: "k", TURN_KEY_API_TOKEN: "t" } as never, "u1"))
      .toEqual(STUN_ONLY);
  });
});

describe("GET /api/turn", () => {
  beforeEach(() => reset());

  it("gecerli oturumla ice sunucu listesi doner", async () => {
    const token = await kayit("A1", "napol");
    const res = await stub().fetch(`https://kovan.test/api/turn?token=${token}`);
    expect(res.status).toBe(200);
    const govde = await res.json<{ iceServers: unknown[] }>();
    expect(Array.isArray(govde.iceServers)).toBe(true);
    expect(govde.iceServers.length).toBeGreaterThan(0);
  });

  it("tokensiz istek 401 doner", async () => {
    const res = await stub().fetch("https://kovan.test/api/turn");
    expect(res.status).toBe(401);
  });

  it("gecersiz token 401 doner", async () => {
    const res = await stub().fetch("https://kovan.test/api/turn?token=uydurma");
    expect(res.status).toBe(401);
  });
});
