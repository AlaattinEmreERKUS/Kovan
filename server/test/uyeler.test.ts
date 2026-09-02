import { runInDurableObject } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { baglan, bekle, kayit, reset, stub } from "./helpers";
import { kullaniciListesi, kullanicilariSil } from "../src/users";

const BASE = "https://kovan.test";

describe("member.new yayini", () => {
  beforeEach(() => reset());

  it("yeni baglanan uye digerlerine yayilir", async () => {
    // Sunucu yeni uyeyi yaymazsa, bagli olan taraf onu tanimadigi icin
    // arayuzde adi "…" gorunur ve ancak sayfa yenilenince duzelir.
    const wsA = await baglan(await kayit("A1", "napol"));
    await bekle(wsA, "hello");

    const b = bekle(wsA, "member.new");
    const wsB = await baglan(await kayit("A2", "denis"));
    const helloB = await bekle(wsB, "hello");

    const olay = await b;
    expect(olay.user.id).toBe(helloB.me.id);
    expect(olay.user.username).toBe("denis");
  });

  it("kendi baglantisinda kendine gitmez", async () => {
    const wsA = await baglan(await kayit("A1", "napol"));
    await bekle(wsA, "hello");
    let kendineGeldi = false;
    wsA.addEventListener("message", (e) => {
      if (JSON.parse(e.data as string).t === "member.new") kendineGeldi = true;
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(kendineGeldi).toBe(false);
  });
});

describe("kullanici silme (saf katman)", () => {
  beforeEach(() => reset(["A1", "A2", "A3"]));

  it("listede mesaj sayisi da doner", async () => {
    const token = await kayit("A1", "napol");
    const ws = await baglan(token);
    await bekle(ws, "hello");
    ws.send(JSON.stringify({ t: "msg.send", content: "selam", localId: "1" }));
    await bekle(ws, "msg.new");

    const liste = await runInDurableObject(stub(), (_i, state) =>
      kullaniciListesi(state.storage.sql));
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({ username: "napol", mesajSayisi: 1 });
  });

  it("verilen kullanicilari ve izlerini siler, digerlerine dokunmaz", async () => {
    const tokenA = await kayit("A1", "napol");
    const tokenB = await kayit("A2", "cop");
    const wsA = await baglan(tokenA);
    const wsB = await baglan(tokenB);
    await bekle(wsA, "hello");
    await bekle(wsB, "hello");

    wsA.send(JSON.stringify({ t: "msg.send", content: "kalan", localId: "1" }));
    const kalanMsg = await bekle(wsA, "msg.new");
    wsB.send(JSON.stringify({ t: "msg.send", content: "gidecek", localId: "2" }));
    await bekle(wsB, "msg.new");
    // Silinecek kullanici, KALACAK mesaja tepki vermis olsun.
    wsB.send(JSON.stringify({ t: "reaction.toggle", messageId: kalanMsg.message.id, emoji: "🔥" }));
    await bekle(wsB, "reaction.update");

    const sonuc = await runInDurableObject(stub(), (_i, state) =>
      kullanicilariSil(state.storage.sql, ["cop"]));
    expect(sonuc.ids).toHaveLength(1);

    const kalanlar = await runInDurableObject(stub(), (_i, state) => ({
      kullanicilar: kullaniciListesi(state.storage.sql).map((u) => u.username),
      mesajlar: state.storage.sql.exec<{ content: string }>("SELECT content FROM messages")
        .toArray().map((m) => m.content),
      tepki: state.storage.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM reactions")
        .one().n,
      oturum: state.storage.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM sessions")
        .one().n,
    }));
    expect(kalanlar.kullanicilar).toEqual(["napol"]);
    expect(kalanlar.mesajlar).toEqual(["kalan"]);
    // Silinen kisinin BASKASININ mesajina verdigi tepki de gitti.
    expect(kalanlar.tepki).toBe(0);
    // Oturumu da gitti: elindeki token artik hicbir seye yaramaz.
    expect(kalanlar.oturum).toBe(1);
  });

  it("silinen kullanicinin mesajina verilen tepkiler de gider", async () => {
    const tokenA = await kayit("A1", "napol");
    const tokenB = await kayit("A2", "cop");
    const wsA = await baglan(tokenA);
    const wsB = await baglan(tokenB);
    await bekle(wsA, "hello");
    await bekle(wsB, "hello");

    wsB.send(JSON.stringify({ t: "msg.send", content: "gidecek", localId: "1" }));
    const msg = await bekle(wsB, "msg.new");
    wsA.send(JSON.stringify({ t: "reaction.toggle", messageId: msg.message.id, emoji: "👍" }));
    await bekle(wsA, "reaction.update");

    await runInDurableObject(stub(), (_i, state) => kullanicilariSil(state.storage.sql, ["cop"]));
    const tepki = await runInDurableObject(stub(), (_i, state) =>
      state.storage.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM reactions").one().n);
    expect(tepki).toBe(0);
  });

  it("bilinmeyen kullanici adi sessizce atlanir", async () => {
    await kayit("A1", "napol");
    const sonuc = await runInDurableObject(stub(), (_i, state) =>
      kullanicilariSil(state.storage.sql, ["yok-boyle-biri"]));
    expect(sonuc.ids).toEqual([]);
    const liste = await runInDurableObject(stub(), (_i, state) =>
      kullaniciListesi(state.storage.sql));
    expect(liste).toHaveLength(1);
  });
});

describe("yonetici kullanici uclari", () => {
  beforeEach(() => reset());

  it("ADMIN_KEY tanimsizken liste ve silme kapali", async () => {
    await kayit("A1", "napol");
    const liste = await stub().fetch(`${BASE}/api/admin/users`);
    expect(liste.status).toBe(403);

    const sil = await stub().fetch(`${BASE}/api/admin/users/delete`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin": "tahmin" },
      body: JSON.stringify({ usernames: ["napol"] }),
    });
    expect(sil.status).toBe(403);

    // Kullanici duruyor.
    const kalan = await runInDurableObject(stub(), (_i, state) =>
      kullaniciListesi(state.storage.sql));
    expect(kalan).toHaveLength(1);
  });
});
