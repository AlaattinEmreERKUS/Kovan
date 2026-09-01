import { describe, it, expect, beforeEach } from "vitest";
import { baglan, bekle, kayit, reset } from "./helpers";

describe("sync", () => {
  beforeEach(() => reset());

  it("yalnizca lastMessageId sonrasini doner", async () => {
    const ws = await baglan(await kayit("A1", "napol"));
    await bekle(ws, "hello");

    const idler: number[] = [];
    for (const metin of ["bir", "iki", "uc"]) {
      const b = bekle(ws, "msg.new");
      ws.send(JSON.stringify({ t: "msg.send", content: metin, localId: metin }));
      idler.push((await b).message.id);
    }

    const b = bekle(ws, "sync.result");
    ws.send(JSON.stringify({ t: "sync", lastMessageId: idler[0] }));
    const sonuc = await b;

    expect(sonuc.messages.map((m) => m.content)).toEqual(["iki", "uc"]);
  });

  it("lastMessageId 0 ise tum gecmisi doner", async () => {
    const ws = await baglan(await kayit("A1", "napol"));
    await bekle(ws, "hello");
    const b1 = bekle(ws, "msg.new");
    ws.send(JSON.stringify({ t: "msg.send", content: "tek", localId: "y" }));
    await b1;

    const b2 = bekle(ws, "sync.result");
    ws.send(JSON.stringify({ t: "sync", lastMessageId: 0 }));
    expect((await b2).messages).toHaveLength(1);
  });

  it("guncelse bos dizi doner", async () => {
    const ws = await baglan(await kayit("A1", "napol"));
    await bekle(ws, "hello");
    const b = bekle(ws, "sync.result");
    ws.send(JSON.stringify({ t: "sync", lastMessageId: 999999 }));
    expect((await b).messages).toEqual([]);
  });

  it("sayi olmayan lastMessageId bastan sayilir, sessizce bos donmez", async () => {
    const ws = await baglan(await kayit("A1", "napol"));
    await bekle(ws, "hello");
    const b1 = bekle(ws, "msg.new");
    ws.send(JSON.stringify({ t: "msg.send", content: "tek", localId: "y" }));
    await b1;

    for (const kotu of ["abc", null, 1.5, -3]) {
      const b = bekle(ws, "sync.result");
      ws.send(JSON.stringify({ t: "sync", lastMessageId: kotu }));
      expect((await b).messages.map((m) => m.content), String(kotu)).toEqual(["tek"]);
    }
  });
});
