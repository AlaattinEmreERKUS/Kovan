import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetVoice, voice } from "../voice.svelte";
import { kur, uye } from "./test-destek";

beforeEach(() => resetVoice());
afterEach(() => resetVoice());

describe("mikrofonsuz katilim", () => {
  it("mikrofon alinamasa da kanala girilir", async () => {
    const { session, deps } = kur();
    (deps.getUserMedia as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("NotAllowedError"));
    voice.members = [uye("u1"), uye("u2")];

    await session.join();

    expect(voice.joined).toBe(true);
    expect(voice.mikYok).toBe(true);
    expect(voice.error).toBeTruthy();
  });

  it("mikrofonsuz katilimda mic yuvasina null gider", async () => {
    const { session, deps, pcler } = kur();
    (deps.getUserMedia as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("NotAllowedError"));
    voice.members = [uye("u1"), uye("u2")];

    await session.join();

    expect(pcler[0].transceivers[0].sender.replaceTrack).toHaveBeenCalledWith(null);
  });

  /** Asil kurtarma: sayfa yenilemeden mikrofon devreye girmeli. */
  it("sonradan cihaz secilince mikrofon devreye girer", async () => {
    const { session, deps, pcler } = kur();
    (deps.getUserMedia as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("NotAllowedError"));
    voice.members = [uye("u1"), uye("u2")];
    await session.join();
    const sender = pcler[0].transceivers[0].sender;
    sender.replaceTrack.mockClear();

    await session.setGirisCihazi("mik-1");

    expect(voice.mikYok).toBe(false);
    expect(sender.replaceTrack).toHaveBeenCalled();
    expect(sender.replaceTrack.mock.calls[0][0]).not.toBeNull();
  });
});

describe("cihaz kaybolunca kurtarma", () => {
  it("secili giris kaybolunca varsayilana duser, TERCIH silinmez", async () => {
    const { session, cihazlar, olaylar } = kur();
    voice.members = [uye("u2")];
    await session.join();
    cihazlar.liste = [
      { deviceId: "mik-1", kind: "audioinput", label: "A", groupId: "g" },
    ] as MediaDeviceInfo[];
    await session.setGirisCihazi("mik-1");

    cihazlar.liste = [];
    await olaylar.tetikle("devicechange");

    expect(voice.etkinGiris).toBeNull();
    expect(session.girisTercihi()).toBe("mik-1");
  });

  it("cihaz geri gelince tercihe donulur", async () => {
    const { session, cihazlar, olaylar } = kur();
    voice.members = [uye("u2")];
    await session.join();
    cihazlar.liste = [
      { deviceId: "mik-1", kind: "audioinput", label: "A", groupId: "g" },
    ] as MediaDeviceInfo[];
    await session.setGirisCihazi("mik-1");
    cihazlar.liste = [];
    await olaylar.tetikle("devicechange");

    cihazlar.liste = [
      { deviceId: "mik-1", kind: "audioinput", label: "A", groupId: "g" },
    ] as MediaDeviceInfo[];
    await olaylar.tetikle("devicechange");

    expect(voice.etkinGiris).toBe("mik-1");
  });

  it("kanaldan cikinca dinleyici kaldirilir", async () => {
    const { session, olaylar } = kur();
    voice.members = [uye("u2")];
    await session.join();
    expect(olaylar.sayi("devicechange")).toBe(1);
    session.leave();
    expect(olaylar.sayi("devicechange")).toBe(0);
  });
});
