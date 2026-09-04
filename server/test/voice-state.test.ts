import { describe, it, expect } from "vitest";
import { VOICE_CAP, sanitizeVoiceFlags, voiceFull, voiceMembers } from "../src/voice";
import type { SocketState } from "../src/sockets";

function durum(userId: string, patch: Partial<SocketState> = {}): SocketState {
  return {
    userId, username: userId, displayName: userId, joinedAt: 0,
    inVoice: false, muted: false, deafened: false,
    camera: false, screen: false, screenAudio: false,
    ...patch,
  };
}

describe("voiceMembers", () => {
  it("yalnizca seste olanlari dondurur", () => {
    const liste = voiceMembers([durum("a", { inVoice: true }), durum("b")]);
    expect(liste.map((m) => m.userId)).toEqual(["a"]);
  });

  // Ikizleme olmamali; catisan bayraklarda EN YENI sekme kazanir (kopma
  // sonrasi geri baglanan kisi olu kaydiyla temsil edilmesin diye).
  it("ayni kullanicinin iki sekmesini tek kayda indirir", () => {
    const liste = voiceMembers([
      durum("a", { inVoice: true, muted: true, joinedAt: 1 }),
      durum("a", { inVoice: true, joinedAt: 2 }),
    ]);
    expect(liste).toHaveLength(1);
    expect(liste[0].muted).toBe(false);
  });

  it("bayraklari tasir", () => {
    const liste = voiceMembers([durum("a", { inVoice: true, screen: true, screenAudio: true })]);
    expect(liste[0]).toEqual({
      userId: "a", muted: false, deafened: false,
      camera: false, screen: true, screenAudio: true,
    });
  });
});

describe("sanitizeVoiceFlags", () => {
  const tam = { muted: true, deafened: false, camera: false, screen: true, screenAudio: false };

  it("bes bayrak da boolean ise kabul eder", () => {
    expect(sanitizeVoiceFlags({ t: "voice.state", ...tam })).toEqual(tam);
  });

  it("bir bayrak boolean degilse tumunu reddeder", () => {
    expect(sanitizeVoiceFlags({ ...tam, muted: "evet" })).toBeNull();
    expect(sanitizeVoiceFlags({ ...tam, camera: 1 })).toBeNull();
  });

  it("eksik bayragi reddeder", () => {
    const eksik = { muted: true, deafened: false, camera: false, screen: true };
    expect(sanitizeVoiceFlags(eksik)).toBeNull();
  });

  it("nesne olmayan girdiyi reddeder", () => {
    expect(sanitizeVoiceFlags(null)).toBeNull();
    expect(sanitizeVoiceFlags("voice.state")).toBeNull();
    expect(sanitizeVoiceFlags(42)).toBeNull();
    expect(sanitizeVoiceFlags([true, true, true, true, true])).toBeNull();
  });
});

describe("voiceFull", () => {
  const dolu = Array.from({ length: VOICE_CAP }, (_, i) => durum(`u${i}`, { inVoice: true }));

  it("tavana ulasildiysa yeni kisiye dolu der", () => {
    expect(voiceFull(dolu, "yeni")).toBe(true);
  });

  it("zaten iceridekine dolu demez", () => {
    expect(voiceFull(dolu, "u0")).toBe(false);
  });

  it("bos kanalda dolu demez", () => {
    expect(voiceFull([], "yeni")).toBe(false);
  });
});
