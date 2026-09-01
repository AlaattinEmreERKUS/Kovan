import { describe, it, expect, beforeEach } from "vitest";
import { baglan, bekle, kayit, reset } from "./helpers";

describe("typing ve presence", () => {
  beforeEach(() => reset());

  it("typing digerlerine gider, gonderene gitmez", async () => {
    const wsA = await baglan(await kayit("A1", "napol"));
    const wsB = await baglan(await kayit("A2", "denis"));
    const helloA = await bekle(wsA, "hello");
    await bekle(wsB, "hello");

    let kendineGeldi = false;
    wsA.addEventListener("message", (e) => {
      if (JSON.parse(e.data as string).t === "typing") kendineGeldi = true;
    });

    const b = bekle(wsB, "typing");
    wsA.send(JSON.stringify({ t: "typing" }));
    expect((await b).userId).toBe(helloA.me.id);
    expect(kendineGeldi).toBe(false);
  });

  it("yeni baglanti digerlerine presence.update online yayar", async () => {
    const wsA = await baglan(await kayit("A1", "napol"));
    await bekle(wsA, "hello");

    const b = bekle(wsA, "presence.update");
    const wsB = await baglan(await kayit("A2", "denis"));
    const helloB = await bekle(wsB, "hello");

    const olay = await b;
    expect(olay.userId).toBe(helloB.me.id);
    expect(olay.online).toBe(true);
  });

  it("kapanan baglanti offline yayar", async () => {
    const wsA = await baglan(await kayit("A1", "napol"));
    await bekle(wsA, "hello");
    const wsB = await baglan(await kayit("A2", "denis"));
    const helloB = await bekle(wsB, "hello");
    await bekle(wsA, "presence.update");

    const b = bekle(wsA, "presence.update");
    wsB.close();
    const olay = await b;
    expect(olay.userId).toBe(helloB.me.id);
    expect(olay.online).toBe(false);
  });
});
