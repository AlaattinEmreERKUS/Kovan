import { describe, it, expect, vi } from "vitest";
import { cihazlariListele, izinAl, type CihazDeps } from "./cihazlar";

function bilgi(deviceId: string, kind: MediaDeviceKind, label: string): MediaDeviceInfo {
  return { deviceId, kind, label, groupId: "g" } as MediaDeviceInfo;
}

function deps(liste: MediaDeviceInfo[], izinVer = true): CihazDeps {
  const track = { stop: vi.fn() } as unknown as MediaStreamTrack;
  return {
    enumerateDevices: vi.fn(async () => liste),
    getUserMedia: vi.fn(async () => {
      if (!izinVer) throw new Error("NotAllowedError");
      return { getTracks: () => [track] } as unknown as MediaStream;
    }),
  };
}

describe("cihazlariListele", () => {
  it("girisleri ve cikislari ayirir", async () => {
    const { girisler, cikislar } = await cihazlariListele(deps([
      bilgi("m1", "audioinput", "Mikrofon A"),
      bilgi("s1", "audiooutput", "Kulaklik A"),
      bilgi("k1", "videoinput", "Kamera"),
    ]));
    expect(girisler).toEqual([{ id: "m1", etiket: "Mikrofon A" }]);
    expect(cikislar).toEqual([{ id: "s1", etiket: "Kulaklik A" }]);
  });

  /**
   * Chromium ayni cihazi default + communications + gercek id olarak ucler.
   * IKISI DE sahte, ikisi de elenir. "Sistem varsayilani"nin tek temsili
   * arayuzdeki bos degerdir; `default`i ayrica listelemek menude IKI
   * "Varsayilan" satiri uretiyordu (2026-09-05 fiziksel test).
   */
  it("default ve communications ikizlerini eler", async () => {
    const { girisler } = await cihazlariListele(deps([
      bilgi("default", "audioinput", "Varsayilan - Mikrofon A"),
      bilgi("communications", "audioinput", "Iletisim - Mikrofon A"),
      bilgi("m1", "audioinput", "Mikrofon A"),
    ]));
    expect(girisler).toEqual([{ id: "m1", etiket: "Mikrofon A" }]);
  });

  it("etiket bossa adsiz cihaz yazar", async () => {
    const { girisler } = await cihazlariListele(deps([bilgi("m1", "audioinput", "")]));
    expect(girisler).toEqual([{ id: "m1", etiket: "Adsız cihaz" }]);
  });

  it("enumerateDevices patlarsa bos liste doner", async () => {
    const d: CihazDeps = {
      enumerateDevices: vi.fn(async () => { throw new Error("yok"); }),
      getUserMedia: vi.fn(),
    };
    expect(await cihazlariListele(d)).toEqual({ girisler: [], cikislar: [] });
  });
});

describe("izinAl", () => {
  it("izin verilince track'i hemen durdurur", async () => {
    const d = deps([]);
    expect(await izinAl(d)).toBe(true);
    const stream = await (d.getUserMedia as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(stream.getTracks()[0].stop).toHaveBeenCalled();
  });

  it("izin reddedilirse false doner, patlamaz", async () => {
    expect(await izinAl(deps([], false))).toBe(false);
  });
});
