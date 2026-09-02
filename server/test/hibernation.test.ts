import { runInDurableObject } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { baglan, bekle, kayit, reset, stub } from "./helpers";
import { onlineUserIds, readState, writeState } from "../src/sockets";
import { voiceMembers } from "../src/voice";

describe("hibernation guvenligi (R3)", () => {
  beforeEach(() => reset());

  it("online listesi instance alanindan degil socketlerden turetilir", async () => {
    const wsA = await baglan(await kayit("A1", "napol"));
    const wsB = await baglan(await kayit("A2", "denis"));
    const helloA = await bekle(wsA, "hello");
    const helloB = await bekle(wsB, "hello");

    await runInDurableObject(stub(), (_instance, state) => {
      // Instance'ta hiçbir üye/presence alanı OLMAMALI.
      const alanlar = Object.keys(_instance as object);
      expect(alanlar).not.toContain("members");
      expect(alanlar).not.toContain("online");
      expect(alanlar).not.toContain("voiceMembers");

      const idler = onlineUserIds(state);
      expect(idler.sort()).toEqual([helloA.me.id, helloB.me.id].sort());
    });
  });

  it("attachmenta yazilan durum ayni socketten geri okunur", async () => {
    await baglan(await kayit("A1", "napol"));

    await runInDurableObject(stub(), (_i, state) => {
      const ws = state.getWebSockets()[0];
      writeState(ws, { inVoice: true, muted: true });
    });

    // Ayrı bir çalıştırma: instance belleğine değil attachment'a bakılıyor.
    await runInDurableObject(stub(), (_i, state) => {
      const durum = readState(state.getWebSockets()[0]);
      expect(durum.inVoice).toBe(true);
      expect(durum.muted).toBe(true);
      expect(durum.username).toBe("napol");
    });
  });

  it("ses uyeligi instance bellegi degil attachment kaynaklidir (R3)", async () => {
    const wsA = await baglan(await kayit("A1", "napol"));
    const helloA = await bekle(wsA, "hello");
    wsA.send(JSON.stringify({ t: "voice.join" }));
    await bekle(wsA, "voice.members");
    wsA.send(JSON.stringify({
      t: "voice.state", muted: true, deafened: false,
      camera: false, screen: true, screenAudio: true,
    }));
    await bekle(wsA, "voice.members");

    // Ayri bir calistirma: instance alanina degil attachment a bakiliyor.
    // DO uyutulup uyandirildiginda hayatta kalan tek sey budur.
    await runInDurableObject(stub(), (_i, state) => {
      const uyeler = voiceMembers(state.getWebSockets().map(readState));
      expect(uyeler).toHaveLength(1);
      expect(uyeler[0]).toMatchObject({
        userId: helloA.me.id, muted: true, screen: true, screenAudio: true,
      });
    });
  });
});
