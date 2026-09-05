import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetVoice, voice } from "../voice.svelte";
import { kur, uye } from "./test-destek";

beforeEach(() => resetVoice());
afterEach(() => resetVoice());

describe("giris cihazi degistirme", () => {
  it("yeni track mesh'e replaceTrack ile girer, yeni transceiver acilmaz", async () => {
    const { session, pcler } = kur();
    voice.members = [uye("u1"), uye("u2")];
    await session.join();
    const acilan = pcler[0].addTransceiver.mock.calls.length;
    const sender = pcler[0].transceivers[0].sender;
    sender.replaceTrack.mockClear();

    await session.setGirisCihazi("mik-yeni");

    expect(sender.replaceTrack).toHaveBeenCalled();
    expect(pcler[0].addTransceiver.mock.calls.length).toBe(acilan);
  });

  it("degisim basarisiz olursa eski cihaz yerinde kalir", async () => {
    const { session, deps, uretilen } = kur();
    voice.members = [uye("u2")];
    await session.join();
    const eski = uretilen[0];
    (deps.getUserMedia as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("OverconstrainedError"));

    await session.setGirisCihazi("yok");

    expect(eski.stop).not.toHaveBeenCalled();
    expect(voice.error).toBeTruthy();
  });

  /** Yeni track mute durumunu miras almaz; acikta kalirsa susturulmus kisi konusur. */
  it("degisimden sonra mute korunur", async () => {
    const { session, uretilen } = kur();
    voice.members = [uye("u2")];
    await session.join();
    session.setMuted(true);

    await session.setGirisCihazi("mik-yeni");

    expect(uretilen[uretilen.length - 1].enabled).toBe(false);
  });

  it("etkin giris store'a yazilir", async () => {
    const { session } = kur();
    voice.members = [uye("u2")];
    await session.join();
    await session.setGirisCihazi("mik-yeni");
    expect(voice.etkinGiris).toBe("mik-yeni");
  });
});

describe("cikis cihazi", () => {
  it("secilen cihaz AudioContext'e uygulanir", async () => {
    const { session, ctx } = kur();
    voice.members = [uye("u2")];
    await session.join();

    await session.setCikisCihazi("kulaklik-1");

    expect(ctx.setSinkId).toHaveBeenCalledWith("kulaklik-1");
    expect(voice.cikisCihazi).toBe("kulaklik-1");
  });

  it("null sistem varsayilanina doner", async () => {
    const { session, ctx } = kur();
    voice.members = [uye("u2")];
    await session.join();
    await session.setCikisCihazi(null);
    expect(ctx.setSinkId).toHaveBeenCalledWith("");
  });

  /** Cihaz kaybolmusken secmek sessiz sagirliga yol acmamali. */
  it("uygulanamazsa varsayilana duser ve hata gosterir", async () => {
    const { session, ctx } = kur();
    voice.members = [uye("u2")];
    await session.join();
    (ctx.setSinkId as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("NotFoundError"));

    await session.setCikisCihazi("yok");

    expect(ctx.setSinkId).toHaveBeenLastCalledWith("");
    expect(voice.cikisCihazi).toBeNull();
    expect(voice.error).toBeTruthy();
  });

  it("katilimda kayitli cikis uygulanir", async () => {
    const { session, ctx } = kur();
    voice.members = [uye("u2")];
    await session.join();
    await session.setCikisCihazi("kulaklik-1");
    session.leave();
    (ctx.setSinkId as ReturnType<typeof vi.fn>).mockClear();

    await session.join();

    expect(ctx.setSinkId).toHaveBeenCalledWith("kulaklik-1");
  });
});
