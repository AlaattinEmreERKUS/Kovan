import { describe, it, expect } from "vitest";
import { buildConstraints } from "./share";

describe("buildConstraints", () => {
  it("30 fps ister", () => {
    expect((buildConstraints().video as { frameRate: number }).frameRate).toBe(30);
  });

  it("displaySurface VERMEZ: native secici on-filtrelenirse pencere paylasilamaz", () => {
    expect(buildConstraints().video).not.toHaveProperty("displaySurface");
  });

  it("sistem sesi kutusunu sunar, secimi kullaniciya birakir", () => {
    const c = buildConstraints();
    expect(c.audio).toBe(true);
    expect(c.systemAudio).toBe("include");
  });

  it("surfaceSwitching acik: kullanici paylasimi yeniden baslatmadan yuzey degistirir", () => {
    expect(buildConstraints().surfaceSwitching).toBe("include");
  });

  /** Ilk kare bile secilen kalitede gelsin: sonradan applyConstraints beklenmez. */
  it("secilen kalitenin video kisitlarini tasir", () => {
    expect(buildConstraints({ cozunurluk: "720p", fps: 60 }).video).toEqual({
      width: { max: 1280 }, height: { max: 720 }, frameRate: 60,
    });
  });

  it("kalite secimi ses ve yuzey ayarlarini degistirmez", () => {
    const c = buildConstraints({ cozunurluk: "1080p", fps: 15 });
    expect(c.audio).toBe(true);
    expect(c.systemAudio).toBe("include");
    expect(c.video).not.toHaveProperty("displaySurface");
  });
});
