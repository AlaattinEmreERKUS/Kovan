import { runInDurableObject } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { baglan, bekle, kayit, reset, stub } from "./helpers";
import { PING, PONG } from "../../shared/protocol";

describe("canli tutma", () => {
  beforeEach(() => reset());

  it("ping auto-response olarak kayitli", async () => {
    // Kurucu calissin diye bir istek at.
    await baglan(await kayit("A1", "napol"));
    await runInDurableObject(stub(), (_i, state) => {
      const cift = state.getWebSocketAutoResponse();
      expect(cift?.request).toBe(PING);
      expect(cift?.response).toBe(PONG);
    });
  });

  it("ping'e pong doner, socket acik kalir", async () => {
    const ws = await baglan(await kayit("A1", "napol"));
    await bekle(ws, "hello");

    const pong = new Promise<string>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("pong gelmedi")), 2000);
      ws.addEventListener("message", (e) => {
        if (e.data === PONG) { clearTimeout(t); resolve(e.data); }
      });
    });
    ws.send(PING);
    expect(await pong).toBe(PONG);

    // Ping sonrasi normal protokol calismaya devam eder.
    ws.send(JSON.stringify({ t: "voice.join" }));
    await bekle(ws, "voice.members");
  });
});
