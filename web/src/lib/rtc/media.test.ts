import { describe, it, expect, vi } from "vitest";
import { LocalMedia, micConstraints, type MediaDeps } from "./media";
import { SES_AYARI_VARSAYILAN } from "../ses-ayarlari";

function sahteTrack(kind: "audio" | "video") {
  return { kind, enabled: true, readyState: "live", stop: vi.fn(), onended: null } as unknown as MediaStreamTrack;
}
function sahteStream(...tracks: MediaStreamTrack[]) {
  return {
    getAudioTracks: () => tracks.filter((t) => t.kind === "audio"),
    getVideoTracks: () => tracks.filter((t) => t.kind === "video"),
    getTracks: () => tracks,
  } as unknown as MediaStream;
}

function kur() {
  const mikrofon = sahteTrack("audio");
  const kamera = sahteTrack("video");
  const deps: MediaDeps = {
    getUserMedia: vi.fn(async (c: MediaStreamConstraints) =>
      c.video ? sahteStream(kamera) : sahteStream(mikrofon)),
    getDisplayMedia: vi.fn(async () => sahteStream()),
  };
  return { media: new LocalMedia(deps), deps, mikrofon, kamera };
}

describe("LocalMedia mikrofon", () => {
  it("startMic kayitli ses ayarlarindaki kisitlarla track alir", async () => {
    const { media, deps, mikrofon } = kur();
    const t = await media.startMic();
    expect(t).toBe(mikrofon);
    expect(media.mic).toBe(mikrofon);
    expect(deps.getUserMedia).toHaveBeenCalledWith(micConstraints());
    const kisit = (deps.getUserMedia as ReturnType<typeof vi.fn>).mock.calls[0][0].audio;
    expect(kisit).toMatchObject({
      echoCancellation: expect.any(Boolean),
      noiseSuppression: expect.any(Boolean),
      autoGainControl: expect.any(Boolean),
    });
  });

  it("setFiltreler track'i degistirmeden kisitlari uygular", async () => {
    const { media } = kur();
    await media.startMic();
    const uygula = vi.fn(async () => {});
    (media.mic as unknown as { applyConstraints: unknown }).applyConstraints = uygula;
    await media.setFiltreler({
      ...SES_AYARI_VARSAYILAN,
      esik: 0.02, yankiEngelleme: false, gurultuBastirma: true, otomatikSeviye: false,
    });
    expect(uygula).toHaveBeenCalledWith({
      echoCancellation: false, noiseSuppression: true, autoGainControl: false,
    });
  });

  it("applyConstraints desteklenmezse patlamaz", async () => {
    const { media } = kur();
    await media.startMic();
    (media.mic as unknown as { applyConstraints: unknown }).applyConstraints =
      vi.fn(async () => { throw new Error("desteklenmiyor"); });
    await expect(media.setFiltreler({
      ...SES_AYARI_VARSAYILAN,
      esik: 0, yankiEngelleme: true, gurultuBastirma: true, otomatikSeviye: true,
    })).resolves.toBeUndefined();
  });

  it("ikinci startMic yeni izin istemez", async () => {
    const { media, deps } = kur();
    await media.startMic();
    await media.startMic();
    expect(deps.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("mute track'i devre disi birakir, durdurmaz", async () => {
    const { media, mikrofon } = kur();
    await media.startMic();
    media.setMuted(true);
    expect(mikrofon.enabled).toBe(false);
    expect(mikrofon.stop).not.toHaveBeenCalled();
    media.setMuted(false);
    expect(mikrofon.enabled).toBe(true);
  });

  it("mikrofon yokken setMuted patlamaz", () => {
    const { media } = kur();
    expect(() => media.setMuted(true)).not.toThrow();
  });
});

describe("LocalMedia kamera", () => {
  it("startCamera video track alir", async () => {
    const { media, kamera } = kur();
    expect(await media.startCamera()).toBe(kamera);
    expect(media.cam).toBe(kamera);
  });

  it("stopCamera track'i durdurur ve alani temizler", async () => {
    const { media, kamera } = kur();
    await media.startCamera();
    media.stopCamera();
    expect(kamera.stop).toHaveBeenCalled();
    expect(media.cam).toBeNull();
  });
});

describe("LocalMedia stopAll", () => {
  it("tum track'leri durdurur", async () => {
    const { media, mikrofon, kamera } = kur();
    await media.startMic();
    await media.startCamera();
    media.stopAll();
    expect(mikrofon.stop).toHaveBeenCalled();
    expect(kamera.stop).toHaveBeenCalled();
    expect(media.mic).toBeNull();
    expect(media.cam).toBeNull();
  });
});

describe("LocalMedia ekran paylasimi", () => {
  function ekranKur(sesVar: boolean) {
    const video = sahteTrack("video");
    const audio = sahteTrack("audio");
    const deps: MediaDeps = {
      getUserMedia: vi.fn(),
      getDisplayMedia: vi.fn(async () => sahteStream(...(sesVar ? [video, audio] : [video]))),
    };
    return { media: new LocalMedia(deps), deps, video, audio };
  }

  it("sistem sesi acikken iki track doner", async () => {
    const { media, video, audio } = ekranKur(true);
    const sonuc = await media.startScreen();
    expect(sonuc.video).toBe(video);
    expect(sonuc.audio).toBe(audio);
    expect(media.screenVideo).toBe(video);
    expect(media.screenAudio).toBe(audio);
  });

  it("ses track'i yoksa audio null olur, patlamaz", async () => {
    const { media } = ekranKur(false);
    const sonuc = await media.startScreen();
    expect(sonuc.audio).toBeNull();
  });

  it("secim native seciciye birakilir: displaySurface gonderilmez", async () => {
    const { media, deps } = ekranKur(true);
    await media.startScreen();
    const c = (deps.getDisplayMedia as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(c.video).not.toHaveProperty("displaySurface");
    expect(c.audio).toBe(true); // ses kutusunu SUNAR; isaretlemek kullanicinin
  });

  it("stopScreen iki track'i de durdurur", async () => {
    const { media, video, audio } = ekranKur(true);
    await media.startScreen();
    media.stopScreen();
    expect(video.stop).toHaveBeenCalled();
    expect(audio.stop).toHaveBeenCalled();
    expect(media.screenVideo).toBeNull();
    expect(media.screenAudio).toBeNull();
  });
});

describe("LocalMedia ekran kaynagi degistirme", () => {
  /** Her cagrida FARKLI track uretir; degistirme testinin sarti tam olarak bu. */
  function degistirKur() {
    const akislar: Array<{ video: MediaStreamTrack; audio: MediaStreamTrack }> = [];
    const durum = { reddet: false };
    const deps: MediaDeps = {
      getUserMedia: vi.fn(),
      getDisplayMedia: vi.fn(async () => {
        if (durum.reddet) throw new DOMException("iptal", "NotAllowedError");
        const video = sahteTrack("video");
        const audio = sahteTrack("audio");
        akislar.push({ video, audio });
        return sahteStream(video, audio);
      }),
    };
    return { media: new LocalMedia(deps), akislar, durum };
  }

  it("ikinci startScreen eski track'leri durdurur", async () => {
    // Durdurulmazsa eski yakalama arka planda yasamaya devam eder: kullanici
    // paylasimi birakti sanir, pencere hala okunuyordur.
    const { media, akislar } = degistirKur();
    await media.startScreen();
    await media.startScreen();

    const [eski, yeni] = akislar;
    expect(eski.video.stop).toHaveBeenCalled();
    expect(eski.audio.stop).toHaveBeenCalled();
    expect(yeni.video.stop).not.toHaveBeenCalled();
    expect(media.screenVideo).toBe(yeni.video);
    expect(media.screenAudio).toBe(yeni.audio);
  });

  it("secici reddedilirse eski track'ler yasamaya devam eder", async () => {
    // SIRA onemli: eskiyi yeni akis GELDIKTEN sonra birakiyoruz. Once
    // biraksaydik vazgecen kullanici paylasimini komple kaybederdi.
    const { media, akislar, durum } = degistirKur();
    await media.startScreen();
    const eski = akislar[0];

    durum.reddet = true;
    await expect(media.startScreen()).rejects.toThrow();

    expect(eski.video.stop).not.toHaveBeenCalled();
    expect(media.screenVideo).toBe(eski.video);
  });
});
