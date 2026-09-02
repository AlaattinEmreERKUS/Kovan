import { describe, it, expect, beforeEach } from "vitest";
import { baglan, bekle, kayit, reset } from "./helpers";

describe("ses kanali uyeligi", () => {
  beforeEach(() => reset(["A1", "A2", "A3", "A4", "A5"]));

  it("hello bos ses listesiyle gelir", async () => {
    const wsA = await baglan(await kayit("A1", "napol"));
    const helloA = await bekle(wsA, "hello");
    expect(helloA.voiceMembers).toEqual([]);
  });

  it("katilim gonderene ve digerlerine yayilir", async () => {
    const wsA = await baglan(await kayit("A1", "napol"));
    await bekle(wsA, "hello");
    const wsB = await baglan(await kayit("A2", "denis"));
    const helloB = await bekle(wsB, "hello");
    await bekle(wsA, "presence.update");

    const digerinde = bekle(wsA, "voice.members");
    const gonderende = bekle(wsB, "voice.members");
    wsB.send(JSON.stringify({ t: "voice.join" }));

    expect((await digerinde).members.map((m) => m.userId)).toEqual([helloB.me.id]);
    expect((await gonderende).members).toHaveLength(1);
  });

  it("varsayilan bayraklar kapali gelir", async () => {
    const wsA = await baglan(await kayit("A1", "napol"));
    await bekle(wsA, "hello");
    wsA.send(JSON.stringify({ t: "voice.join" }));
    const uyeler = (await bekle(wsA, "voice.members")).members;
    expect(uyeler[0]).toMatchObject({
      muted: false, deafened: false, camera: false, screen: false, screenAudio: false,
    });
  });

  it("sonradan baglanan hello icinde mevcut ses listesini alir", async () => {
    const wsA = await baglan(await kayit("A1", "napol"));
    const helloA = await bekle(wsA, "hello");
    wsA.send(JSON.stringify({ t: "voice.join" }));
    await bekle(wsA, "voice.members");

    const wsB = await baglan(await kayit("A2", "denis"));
    const helloB = await bekle(wsB, "hello");
    expect(helloB.voiceMembers.map((m) => m.userId)).toEqual([helloA.me.id]);
  });

  it("ayrilma listeden dusurur", async () => {
    const wsA = await baglan(await kayit("A1", "napol"));
    await bekle(wsA, "hello");
    wsA.send(JSON.stringify({ t: "voice.join" }));
    expect((await bekle(wsA, "voice.members")).members).toHaveLength(1);

    wsA.send(JSON.stringify({ t: "voice.leave" }));
    expect((await bekle(wsA, "voice.members")).members).toEqual([]);
  });

  it("besinci kisi ses_dolu hatasi alir", async () => {
    for (let i = 1; i <= 4; i++) {
      const ws = await baglan(await kayit(`A${i}`, `kisi${i}`));
      await bekle(ws, "hello");
      ws.send(JSON.stringify({ t: "voice.join" }));
      await bekle(ws, "voice.members");
    }
    const wsE = await baglan(await kayit("A5", "kisi5"));
    await bekle(wsE, "hello");
    wsE.send(JSON.stringify({ t: "voice.join" }));
    expect((await bekle(wsE, "error")).code).toBe("ses_dolu");
  });
});
