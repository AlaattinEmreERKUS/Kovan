import { runInDurableObject } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { baglan, bekle, kayit, reset, stub } from "./helpers";
import type { SocketState } from "../src/sockets";

const BASE = "https://kovan.test";

describe("ws el sikismasi", () => {
  beforeEach(() => reset());

  it("token yoksa 401 doner", async () => {
    const res = await stub().fetch(`${BASE}/ws`, { headers: { Upgrade: "websocket" } });
    expect(res.status).toBe(401);
  });

  it("gecersiz token 401 doner", async () => {
    const res = await stub().fetch(`${BASE}/ws?token=abc`, { headers: { Upgrade: "websocket" } });
    expect(res.status).toBe(401);
  });

  it("gecerli token hello olayi getirir", async () => {
    const token = await kayit("A1", "napol");
    const ws = await baglan(token);
    const hello = await bekle(ws, "hello");

    expect(hello.me.username).toBe("napol");
    expect(hello.members.map((u) => u.username)).toContain("napol");
    expect(hello.recentMessages).toEqual([]);
    expect(hello.online).toContain(hello.me.id);
  });

  it("durum instance alaninda degil attachmentta tutulur", async () => {
    const token = await kayit("A1", "napol");
    await baglan(token);

    await runInDurableObject(stub(), (_i, state) => {
      const sockets = state.getWebSockets();
      expect(sockets).toHaveLength(1);
      const durum = sockets[0].deserializeAttachment() as SocketState;
      expect(durum.username).toBe("napol");
      expect(durum.inVoice).toBe(false);
    });
  });

  it("ikinci kullanici baglaninca digerine presence.update gider", async () => {
    const napolToken = await kayit("A1", "napol");
    const napol = await baglan(napolToken);
    await bekle(napol, "hello");

    const denisToken = await kayit("A2", "denis");
    const bildirim = bekle(napol, "presence.update");
    await baglan(denisToken);

    const olay = await bildirim;
    expect(olay.online).toBe(true);
  });
});
