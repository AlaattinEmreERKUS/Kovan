import { describe, it, expect, vi } from "vitest";
import { LocalMedia, MIC_CONSTRAINTS, type MediaDeps } from "./media";

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
  it("startMic ses kisitlariyla track alir", async () => {
    const { media, deps, mikrofon } = kur();
    const t = await media.startMic();
    expect(t).toBe(mikrofon);
    expect(media.mic).toBe(mikrofon);
    expect(deps.getUserMedia).toHaveBeenCalledWith(MIC_CONSTRAINTS);
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
    const sonuc = await media.startScreen({ surface: "monitor", systemAudio: true });
    expect(sonuc.video).toBe(video);
    expect(sonuc.audio).toBe(audio);
    expect(media.screenVideo).toBe(video);
    expect(media.screenAudio).toBe(audio);
  });

  it("ses track'i yoksa audio null olur, patlamaz", async () => {
    const { media } = ekranKur(false);
    const sonuc = await media.startScreen({ surface: "window", systemAudio: false });
    expect(sonuc.audio).toBeNull();
  });

  it("constraint on-diyalogdan uretilir", async () => {
    const { media, deps } = ekranKur(true);
    await media.startScreen({ surface: "window", systemAudio: true });
    const c = (deps.getDisplayMedia as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(c.video.displaySurface).toBe("window");
    expect(c.audio).toBe(false); // pencerede sistem sesi yok
  });

  it("stopScreen iki track'i de durdurur", async () => {
    const { media, video, audio } = ekranKur(true);
    await media.startScreen({ surface: "monitor", systemAudio: true });
    media.stopScreen();
    expect(video.stop).toHaveBeenCalled();
    expect(audio.stop).toHaveBeenCalled();
    expect(media.screenVideo).toBeNull();
    expect(media.screenAudio).toBeNull();
  });
});
