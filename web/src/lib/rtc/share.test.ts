import { describe, it, expect } from "vitest";
import { buildConstraints, systemAudioAvailable } from "./share";

describe("systemAudioAvailable", () => {
  it("tum ekranda sistem sesi alinabilir", () => {
    expect(systemAudioAvailable("monitor")).toBe(true);
  });
  it("pencere yakalamada alinamaz (Windows kisiti)", () => {
    expect(systemAudioAvailable("window")).toBe(false);
  });
});

describe("buildConstraints", () => {
  it("tum ekran + sistem sesi", () => {
    expect(buildConstraints({ surface: "monitor", systemAudio: true })).toEqual({
      video: { frameRate: 30, displaySurface: "monitor" },
      audio: true,
      systemAudio: "include",
      surfaceSwitching: "include",
    });
  });

  it("sistem sesi kapaliyken audio false ve exclude", () => {
    const c = buildConstraints({ surface: "monitor", systemAudio: false });
    expect(c.audio).toBe(false);
    expect((c as { systemAudio?: string }).systemAudio).toBe("exclude");
  });

  it("pencere secildiginde sistem sesi istense bile kapatilir", () => {
    const c = buildConstraints({ surface: "window", systemAudio: true });
    expect(c.audio).toBe(false);
    expect((c as { systemAudio?: string }).systemAudio).toBe("exclude");
    expect((c.video as { displaySurface: string }).displaySurface).toBe("window");
  });

  it("surfaceSwitching daima acik: kullanici yeniden baslatmadan yuzey degistirebilir", () => {
    for (const surface of ["monitor", "window"] as const) {
      const c = buildConstraints({ surface, systemAudio: false });
      expect((c as { surfaceSwitching?: string }).surfaceSwitching).toBe("include");
    }
  });
});
