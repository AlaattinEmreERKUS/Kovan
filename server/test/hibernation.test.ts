import { runInDurableObject } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { baglan, bekle, kayit, reset, stub } from "./helpers";
import { onlineUserIds, readState, writeState } from "../src/sockets";

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
});
