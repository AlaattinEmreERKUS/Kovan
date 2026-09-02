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
});
