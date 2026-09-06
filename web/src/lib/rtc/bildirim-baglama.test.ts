import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetVoice, voice } from "../voice.svelte";
import { kur, uye } from "./test-destek";

beforeEach(() => resetVoice());
afterEach(() => resetVoice());

describe("bildirim sesi baglamalari", () => {
  it("kanala katilinca kendi giris sesi calar", async () => {
    const { session, sesler } = kur();

    await session.join();

    expect(sesler).toEqual(["kanala-girdim"]);
  });

  /**
   * `yenidenKatil` kopma sonrasi dogrudan `join()` cagiriyor. Ses join'in
   * sonuna baglanirsa her ag kesintisinde kullanici kendi giris bipini
   * yeniden duyar; kanala girmedi, yalnizca baglanti geri geldi.
   */
  it("yeniden baglanmada giris sesi calmaz", async () => {
    const { session, conn, sesler } = kur();
    voice.members = [uye("u2")];
    await session.join();
    sesler.length = 0;

    conn.onDisconnect!();
    conn.onReconnect!();
    await new Promise((r) => setTimeout(r, 20));

    expect(sesler).toEqual([]);
  });

  it("mikrofon kapanip acilinca ayri sesler calar", async () => {
    const { session, sesler } = kur();
    voice.members = [uye("u2")];
    await session.join();
    sesler.length = 0;

    session.setMuted(true);
    session.setMuted(false);

    expect(sesler).toEqual(["mik-kapandi", "mik-acildi"]);
  });

  it("kulaklik kapanip acilinca ayri sesler calar", async () => {
    const { session, sesler } = kur();
    voice.members = [uye("u2")];
    await session.join();
    sesler.length = 0;

    session.setDeafened(true);
    session.setDeafened(false);

    expect(sesler).toEqual(["kulaklik-kapandi", "kulaklik-acildi"]);
  });

  it("kanaldan ayrilinca cikis sesi calar", async () => {
    const { session, sesler } = kur();
    voice.members = [uye("u2")];
    await session.join();
    sesler.length = 0;

    session.leave();

    expect(sesler).toEqual(["kanaldan-ciktim"]);
  });

  /**
   * `yenidenKatil` kopma anindaki susturmayi setMuted/setDeafened ile geri
   * yukluyor. Bunlar kullanici eylemi degil onarim; ses cikarirlarsa her
   * kesintide sustuurulmus kullanici bip yagmuru duyar.
   */
  it("yeniden baglanmada susturma geri yuklenirken ses calmaz", async () => {
    const { session, conn, sesler } = kur();
    voice.members = [uye("u2")];
    await session.join();
    session.setDeafened(true);
    sesler.length = 0;

    conn.onDisconnect!();
    conn.onReconnect!();
    await new Promise((r) => setTimeout(r, 20));

    expect(sesler).toEqual([]);
  });

  it("baskasi kanala girince ayri ses calar", async () => {
    const { session, conn, sesler } = kur();
    voice.members = [uye("u2")];
    await session.join();
    sesler.length = 0;

    conn.onVoiceMembers!([uye("u2"), uye("u3")]);

    expect(sesler).toEqual(["baskasi-girdi"]);
  });

  it("baskasi kanaldan cikinca ayri ses calar", async () => {
    const { session, conn, sesler } = kur();
    voice.members = [uye("u2"), uye("u3")];
    await session.join();
    sesler.length = 0;

    conn.onVoiceMembers!([uye("u2")]);

    expect(sesler).toEqual(["baskasi-cikti"]);
  });

  /**
   * Asil patlama senaryosu: kopma sonrasi sunucu tam listeyi bastan
   * gonderiyor. Tohumlama olmadan odadaki iki kisi icin iki bip patlar --
   * kimse girmemisken.
   */
  it("kopma sonrasi ilk uye yayini ses cikarmaz", async () => {
    const { session, conn, sesler } = kur();
    voice.members = [uye("u2"), uye("u3"), uye("u4")];
    await session.join();
    conn.onDisconnect!();
    conn.onReconnect!();
    await new Promise((r) => setTimeout(r, 20));
    sesler.length = 0;

    conn.onVoiceMembers!([uye("u2"), uye("u3"), uye("u4")]);

    expect(sesler).toEqual([]);
  });

  /** Kulaklik kapaliyken baskasinin girip cikmasi duyulmaz. */
  it("sagirken baskasinin giris sesi calmaz", async () => {
    const { session, conn, sesler } = kur();
    voice.members = [uye("u2")];
    await session.join();
    session.setDeafened(true);
    sesler.length = 0;

    conn.onVoiceMembers!([uye("u2"), uye("u3")]);

    expect(sesler).toEqual([]);
  });

  /** Kendi eylemin sagirken bile duyulur; yoksa "actim" sesini hic duymazsin. */
  it("sagirken kendi kulaklik acma sesi calar", async () => {
    const { session, sesler } = kur();
    voice.members = [uye("u2")];
    await session.join();
    session.setDeafened(true);
    sesler.length = 0;

    session.setDeafened(false);

    expect(sesler).toEqual(["kulaklik-acildi"]);
  });

  it("ayardan kapatilinca calara bildirilir", async () => {
    const { session, bildirim } = kur();
    voice.members = [uye("u2")];
    await session.join();

    await session.setSesAyarlari({ ...voice.sesAyarlari, bildirimSesleri: false });

    expect(bildirim.setAcik).toHaveBeenCalledWith(false);
  });

  /** Bildirim sesi de secili kulakliktan gelmeli, varsayilan hoparlorden degil. */
  it("cikis cihazi secilince calara da uygulanir", async () => {
    const { session, bildirim } = kur();
    voice.members = [uye("u2")];
    await session.join();

    await session.setCikisCihazi("kulaklik-1");

    expect(bildirim.setCikis).toHaveBeenCalledWith("kulaklik-1");
  });

  /**
   * Kayitli tercih ancak kullanici ayara DOKUNDUGUNDA uygulanirsa, sesleri
   * kapatmis biri uygulamayi her acisinda onlari yeniden duyar.
   */
  it("kayitli kapali tercih katilimda uygulanir", async () => {
    const { session, bildirim } = kur();
    voice.sesAyarlari = { ...voice.sesAyarlari, bildirimSesleri: false };
    voice.members = [uye("u2")];

    await session.join();

    expect(bildirim.setAcik).toHaveBeenCalledWith(false);
  });
});
