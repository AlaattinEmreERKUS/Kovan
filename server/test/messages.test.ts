import { describe, it, expect, beforeEach } from "vitest";
import { baglan, bekle, kayit, reset } from "./helpers";

describe("mesaj gonderme", () => {
  beforeEach(() => reset());

  it("gonderen ve digerleri ayni mesaji alir, localId gonderene doner", async () => {
    const wsA = await baglan(await kayit("A1", "napol"));
    const wsB = await baglan(await kayit("A2", "denis"));
    await bekle(wsA, "hello");
    await bekle(wsB, "hello");

    const bekleyenA = bekle(wsA, "msg.new");
    const bekleyenB = bekle(wsB, "msg.new");
    wsA.send(JSON.stringify({ t: "msg.send", content: "selam", localId: "yerel-1" }));

    const a = await bekleyenA;
    const b = await bekleyenB;

    expect(a.message.content).toBe("selam");
    expect(a.localId).toBe("yerel-1");
    expect(b.message.id).toBe(a.message.id);
    expect(b.localId).toBeUndefined();
  });

  it("mesaj kalici, yeni baglanan hello icinde gorur", async () => {
    const wsA = await baglan(await kayit("A1", "napol"));
    await bekle(wsA, "hello");
    wsA.send(JSON.stringify({ t: "msg.send", content: "kalici", localId: "y1" }));
    await bekle(wsA, "msg.new");

    const wsB = await baglan(await kayit("A2", "denis"));
    const hello = await bekle(wsB, "hello");
    expect(hello.recentMessages.map((m) => m.content)).toEqual(["kalici"]);
  });

  it("bos mesaj reddedilir", async () => {
    const ws = await baglan(await kayit("A1", "napol"));
    await bekle(ws, "hello");
    ws.send(JSON.stringify({ t: "msg.send", content: "   ", localId: "y1" }));
    const hata = await bekle(ws, "error");
    expect(hata.code).toBe("bos_mesaj");
  });

  it("2000 karakterden uzun mesaj reddedilir", async () => {
    const ws = await baglan(await kayit("A1", "napol"));
    await bekle(ws, "hello");
    ws.send(JSON.stringify({ t: "msg.send", content: "a".repeat(2001), localId: "y1" }));
    const hata = await bekle(ws, "error");
    expect(hata.code).toBe("uzun_mesaj");
  });

  it("dusmanca paketler baglantiyi dusurmez, hata olayi doner", async () => {
    const ws = await baglan(await kayit("A1", "napol"));
    await bekle(ws, "hello");

    // content string degil: trim() cagrisi patlarsa socket sessizce olur.
    ws.send(JSON.stringify({ t: "msg.send", content: 42, localId: "y1" }));
    expect((await bekle(ws, "error")).code).toBe("bos_mesaj");

    // gecerli JSON ama nesne degil
    ws.send("null");
    expect((await bekle(ws, "error")).code).toBe("bozuk_paket");

    // bozuk JSON
    ws.send("{ bu json degil");
    expect((await bekle(ws, "error")).code).toBe("bozuk_paket");

    // taninmayan olay
    ws.send(JSON.stringify({ t: "uzay.gemisi" }));
    expect((await bekle(ws, "error")).code).toBe("bilinmeyen_olay");

    // socket hala calisiyor
    ws.send(JSON.stringify({ t: "msg.send", content: "hayattayim", localId: "y2" }));
    expect((await bekle(ws, "msg.new")).message.content).toBe("hayattayim");
  });
});
