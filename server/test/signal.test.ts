import { describe, it, expect, beforeEach } from "vitest";
import { baglan, bekle, kayit, reset } from "./helpers";

async function seste(kod: string, ad: string) {
  const ws = await baglan(await kayit(kod, ad));
  const hello = await bekle(ws, "hello");
  ws.send(JSON.stringify({ t: "voice.join" }));
  await bekle(ws, "voice.members");
  return { ws, id: hello.me.id };
}

describe("signal yonlendirme", () => {
  beforeEach(() => reset(["A1", "A2", "A3"]));

  it("paketi yalnizca hedefe iletir ve icine bakmaz", async () => {
    const a = await seste("A1", "napol");
    const b = await seste("A2", "denis");
    const c = await seste("A3", "ece");

    let ucuncuyeGitti = false;
    c.ws.addEventListener("message", (e) => {
      if (JSON.parse(e.data as string).t === "signal") ucuncuyeGitti = true;
    });

    const govde = { description: { type: "offer", sdp: "v=0\r\nsahte" } };
    const bekleyen = bekle(b.ws, "signal");
    a.ws.send(JSON.stringify({ t: "signal", target: b.id, data: govde }));

    const olay = await bekleyen;
    expect(olay.from).toBe(a.id);
    expect(olay.data).toEqual(govde);
    expect(ucuncuyeGitti).toBe(false);
  });

  it("seste olmayan gonderici reddedilir", async () => {
    const ws = await baglan(await kayit("A1", "napol"));
    await bekle(ws, "hello");
    ws.send(JSON.stringify({ t: "signal", target: "birisi", data: {} }));
    expect((await bekle(ws, "error")).code).toBe("seste_degil");
  });

  it("hedef seste degilse reddedilir", async () => {
    const a = await seste("A1", "napol");
    const wsB = await baglan(await kayit("A2", "denis"));
    const helloB = await bekle(wsB, "hello");

    a.ws.send(JSON.stringify({ t: "signal", target: helloB.me.id, data: {} }));
    expect((await bekle(a.ws, "error")).code).toBe("hedef_seste_degil");
  });

  it("kendine sinyal reddedilir", async () => {
    const a = await seste("A1", "napol");
    a.ws.send(JSON.stringify({ t: "signal", target: a.id, data: {} }));
    expect((await bekle(a.ws, "error")).code).toBe("gecersiz_hedef");
  });

  it("string olmayan hedef socketi oldurmez", async () => {
    const a = await seste("A1", "napol");
    const b = await seste("A2", "denis");

    a.ws.send(JSON.stringify({ t: "signal", target: { kotu: true }, data: {} }));
    expect((await bekle(a.ws, "error")).code).toBe("gecersiz_hedef");

    const bekleyen = bekle(b.ws, "signal");
    a.ws.send(JSON.stringify({ t: "signal", target: b.id, data: { candidate: null } }));
    expect((await bekleyen).from).toBe(a.id);
  });

  it("64 KB ustu paket reddedilir", async () => {
    const a = await seste("A1", "napol");
    const b = await seste("A2", "denis");
    a.ws.send(JSON.stringify({ t: "signal", target: b.id, data: { sdp: "x".repeat(70 * 1024) } }));
    expect((await bekle(a.ws, "error")).code).toBe("buyuk_sinyal");
  });
});
