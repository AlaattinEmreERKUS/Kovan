import { describe, it, expect, beforeEach } from "vitest";
import { baglan, bekle, kayit, reset } from "./helpers";

describe("reaksiyonlar", () => {
  beforeEach(() => reset());

  it("ekler, herkese yayilir, ikinci basista siler", async () => {
    const wsA = await baglan(await kayit("A1", "napol"));
    const wsB = await baglan(await kayit("A2", "denis"));
    const helloA = await bekle(wsA, "hello");
    await bekle(wsB, "hello");

    const b = bekle(wsA, "msg.new");
    wsA.send(JSON.stringify({ t: "msg.send", content: "tepki ver", localId: "y" }));
    const mesajId = (await b).message.id;
    await bekle(wsB, "msg.new");

    const ekleB = bekle(wsB, "reaction.update");
    wsA.send(JSON.stringify({ t: "reaction.toggle", messageId: mesajId, emoji: "🔥" }));
    const eklendi = await ekleB;
    expect(eklendi.userIds).toEqual([helloA.me.id]);

    const silB = bekle(wsB, "reaction.update");
    wsA.send(JSON.stringify({ t: "reaction.toggle", messageId: mesajId, emoji: "🔥" }));
    expect((await silB).userIds).toEqual([]);
  });

  it("olmayan mesaja tepki reddedilir", async () => {
    const ws = await baglan(await kayit("A1", "napol"));
    await bekle(ws, "hello");
    ws.send(JSON.stringify({ t: "reaction.toggle", messageId: 999, emoji: "🔥" }));
    expect((await bekle(ws, "error")).code).toBe("mesaj_yok");
  });

  it("hello reaksiyonlari da tasir", async () => {
    const wsA = await baglan(await kayit("A1", "napol"));
    const helloA = await bekle(wsA, "hello");
    const b = bekle(wsA, "msg.new");
    wsA.send(JSON.stringify({ t: "msg.send", content: "x", localId: "y" }));
    const mesajId = (await b).message.id;
    const r = bekle(wsA, "reaction.update");
    wsA.send(JSON.stringify({ t: "reaction.toggle", messageId: mesajId, emoji: "👍" }));
    await r;

    const wsB = await baglan(await kayit("A2", "denis"));
    const helloB = await bekle(wsB, "hello");
    expect(helloB.reactions).toEqual([
      { messageId: mesajId, emoji: "👍", userIds: [helloA.me.id] },
    ]);
  });

  it("bozuk emoji ve messageId reddedilir, socket ayakta kalir", async () => {
    const ws = await baglan(await kayit("A1", "napol"));
    await bekle(ws, "hello");
    const b = bekle(ws, "msg.new");
    ws.send(JSON.stringify({ t: "msg.send", content: "x", localId: "y" }));
    const mesajId = (await b).message.id;

    // emoji string degil: ham deger SQL'e giderse socket olur
    ws.send(JSON.stringify({ t: "reaction.toggle", messageId: mesajId, emoji: { kotu: 1 } }));
    expect((await bekle(ws, "error")).code).toBe("gecersiz_emoji");

    // emoji degil, roman
    ws.send(JSON.stringify({ t: "reaction.toggle", messageId: mesajId, emoji: "a".repeat(100) }));
    expect((await bekle(ws, "error")).code).toBe("gecersiz_emoji");

    // messageId sayi degil
    ws.send(JSON.stringify({ t: "reaction.toggle", messageId: "iki", emoji: "🔥" }));
    expect((await bekle(ws, "error")).code).toBe("mesaj_yok");

    // socket hala calisiyor
    const r = bekle(ws, "reaction.update");
    ws.send(JSON.stringify({ t: "reaction.toggle", messageId: mesajId, emoji: "🔥" }));
    expect((await r).userIds).toHaveLength(1);
  });
});
