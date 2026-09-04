import { runInDurableObject } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { baglan, bekle, kayit, reset, stub } from "./helpers";
import { readState } from "../src/sockets";
import { voiceMembers, type VoiceFlags } from "../src/voice";
import type { SocketState } from "../src/sockets";

/**
 * Ani ag kopmasinda (internet gider, TCP FIN gelmez) runtime webSocketClose
 * DEGIL webSocketError cagirir. Isleyici yoksa kopan kisi ses listesinde
 * hayalet olarak kalir: digerleri onu odada gorur ama kimse konusamaz.
 */
async function kopar(userId: string): Promise<void> {
  await runInDurableObject(stub(), (instance, state) => {
    const ws = state.getWebSockets().find((s) => readState(s).userId === userId);
    if (!ws) throw new Error("kopar(): socket bulunamadi");
    (instance as unknown as {
      webSocketError(ws: WebSocket, e: unknown): void | Promise<void>;
    }).webSocketError(ws, new Error("ag koptu"));
  });
}

describe("ani kopma (webSocketError)", () => {
  beforeEach(() => reset(["A1", "A2", "A3"]));

  it("hata ile kopan socket ses listesinden dusurulur", async () => {
    const wsA = await baglan(await kayit("A1", "napol"));
    const helloA = await bekle(wsA, "hello");
    wsA.send(JSON.stringify({ t: "voice.join" }));
    await bekle(wsA, "voice.members");

    const wsB = await baglan(await kayit("A2", "denis"));
    const helloB = await bekle(wsB, "hello");
    wsB.send(JSON.stringify({ t: "voice.join" }));
    await bekle(wsB, "voice.members");
    await bekle(wsA, "voice.members");

    const bekleyen = bekle(wsA, "voice.members");
    await kopar(helloB.me.id);

    const kalanlar = (await bekleyen).members.map((m) => m.userId);
    expect(kalanlar).toEqual([helloA.me.id]);
  });

  it("hata ile kopan socket cevrimdisi yayinlanir", async () => {
    const wsA = await baglan(await kayit("A1", "napol"));
    await bekle(wsA, "hello");
    const wsB = await baglan(await kayit("A2", "denis"));
    const helloB = await bekle(wsB, "hello");
    await bekle(wsA, "presence.update");

    const bekleyen = bekle(wsA, "presence.update");
    await kopar(helloB.me.id);

    expect(await bekleyen).toMatchObject({ userId: helloB.me.id, online: false });
  });

  it("kopan socket sonraki hello'nun ses listesine de girmez", async () => {
    const wsA = await baglan(await kayit("A1", "napol"));
    const helloA = await bekle(wsA, "hello");
    wsA.send(JSON.stringify({ t: "voice.join" }));
    await bekle(wsA, "voice.members");

    const wsB = await baglan(await kayit("A2", "denis"));
    const helloB = await bekle(wsB, "hello");
    wsB.send(JSON.stringify({ t: "voice.join" }));
    await bekle(wsB, "voice.members");
    await bekle(wsA, "voice.members");

    await kopar(helloB.me.id);

    const wsC = await baglan(await kayit("A3", "kaan"));
    const helloC = await bekle(wsC, "hello");
    expect(helloC.voiceMembers.map((m) => m.userId)).toEqual([helloA.me.id]);
  });
});

describe("ayni kullanicinin iki socketi", () => {
  const bayrak = (p: Partial<VoiceFlags> = {}): VoiceFlags => ({
    muted: false, deafened: false, camera: false, screen: false, screenAudio: false, ...p,
  });
  const soket = (userId: string, joinedAt: number, p: Partial<VoiceFlags> = {}): SocketState => ({
    userId, username: userId, displayName: userId, inVoice: true, joinedAt, ...bayrak(p),
  });

  /**
   * Kopma tespit edilene kadar olu socket listede durabilir. Kullanici o
   * arada geri baglanirsa iki kaydi olur; listeye YENI socket girmeli, yoksa
   * bayraklar bayat kalir ve kisi hep olu kaydiyla temsil edilir.
   */
  it("en yeni socket kazanir", () => {
    const uyeler = voiceMembers([
      soket("u1", 1000, { muted: true }),
      soket("u1", 2000, { muted: false }),
    ]);
    expect(uyeler).toHaveLength(1);
    expect(uyeler[0].muted).toBe(false);
  });

  it("socket sirasi ters gelse de en yeni kazanir", () => {
    const uyeler = voiceMembers([
      soket("u1", 2000, { camera: true }),
      soket("u1", 1000, { camera: false }),
    ]);
    expect(uyeler[0].camera).toBe(true);
  });

  /**
   * Iki sekme mesru: birinde seste, digerinde degil. Yenilik kurali YALNIZCA
   * seste olanlar arasinda isler; sesten bagimsiz yeni bir sekme kisiyi
   * listeden dusurmemeli.
   */
  it("sesten bagimsiz yeni sekme, sesteki eski sekmeyi gizlemez", () => {
    const seste = { ...soket("u1", 1000, { muted: true }), inVoice: true };
    const sessiz = { ...soket("u1", 2000), inVoice: false };
    const uyeler = voiceMembers([seste, sessiz]);
    expect(uyeler).toHaveLength(1);
    expect(uyeler[0].muted).toBe(true);
  });
});
