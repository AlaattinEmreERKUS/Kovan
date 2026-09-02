import { describe, it, expect } from "vitest";
import { basHarf, sahneDuzeni, sahneKareleri, type SahneGirdisi } from "./stage";
import { bosTracks, type RemoteTracks } from "./voice.svelte";
import type { VoiceMember } from "@shared/protocol";

function uye(userId: string, ek: Partial<VoiceMember> = {}): VoiceMember {
  return { userId, muted: false, deafened: false, camera: false, screen: false, screenAudio: false, ...ek };
}

function track(): MediaStreamTrack {
  return { kind: "video", readyState: "live" } as unknown as MediaStreamTrack;
}

function uzak(ek: Partial<RemoteTracks>): RemoteTracks {
  return { ...bosTracks(), ...ek };
}

function girdi(ek: Partial<SahneGirdisi> = {}): SahneGirdisi {
  return {
    members: [uye("ben"), uye("o")],
    remote: new Map(),
    local: { cam: null, screenVideo: null },
    speaking: new Set(),
    connection: new Map(),
    adlar: new Map([["ben", "Napol"], ["o", "Arkadas"]]),
    selfId: "ben",
    selfMuted: false,
    selfDeafened: false,
    mod: "herkes",
    ...ek,
  };
}

describe("basHarf", () => {
  it("ilk harfi buyutur", () => {
    expect(basHarf("napol")).toBe("N");
  });

  it("Turkce i'yi dogru buyutur", () => {
    // Varsayilan toUpperCase "istanbul" -> "I" verir; Turkce'de "İ" olmali.
    expect(basHarf("istanbul")).toBe("İ");
  });

  it("bosluklari atlar", () => {
    expect(basHarf("  emre")).toBe("E");
  });

  it("bos ad icin soru isareti doner", () => {
    expect(basHarf("")).toBe("?");
    expect(basHarf("   ")).toBe("?");
  });
});

describe("sahneKareleri sirasi", () => {
  it("kendi karesi ilk sirada", () => {
    const k = sahneKareleri(girdi());
    expect(k.map((x) => x.userId)).toEqual(["ben", "o"]);
    expect(k[0].kendisi).toBe(true);
    expect(k[1].kendisi).toBe(false);
  });

  it("uye sirasi kendisi disinda korunur", () => {
    const k = sahneKareleri(girdi({
      members: [uye("a"), uye("ben"), uye("b")],
      adlar: new Map([["ben", "Napol"], ["a", "A"], ["b", "B"]]),
    }));
    expect(k.map((x) => x.userId)).toEqual(["ben", "a", "b"]);
  });

  it("ekran kareleri kisi karelerinden once gelir", () => {
    const k = sahneKareleri(girdi({
      members: [uye("ben"), uye("o", { screen: true })],
      remote: new Map([["o", uzak({ screenVideo: track() })]]),
    }));
    expect(k[0]).toMatchObject({ tur: "ekran", userId: "o" });
    expect(k.slice(1).every((x) => x.tur === "kisi")).toBe(true);
  });

  it("kendi ekran paylasimi da kare uretir", () => {
    const k = sahneKareleri(girdi({ local: { cam: null, screenVideo: track() } }));
    expect(k[0]).toMatchObject({ tur: "ekran", userId: "ben", kendisi: true });
  });
});

describe("sahneKareleri kisi karesi", () => {
  it("kamera kapaliyken track null, harf dolu", () => {
    const k = sahneKareleri(girdi());
    expect(k[0]).toMatchObject({ tur: "kisi", track: null, harf: "N", ad: "Napol" });
  });

  it("kendi kameran acikken local.cam kullanilir", () => {
    const t = track();
    const k = sahneKareleri(girdi({ local: { cam: t, screenVideo: null } }));
    expect(k[0]).toMatchObject({ tur: "kisi", track: t, kendisi: true });
  });

  it("uzak kamera remote'tan gelir", () => {
    const t = track();
    const k = sahneKareleri(girdi({
      members: [uye("ben"), uye("o", { camera: true })],
      remote: new Map([["o", uzak({ cam: t })]]),
    }));
    expect(k[1]).toMatchObject({ userId: "o", track: t });
  });

  it("konusma bayragi speaking'den gelir", () => {
    const k = sahneKareleri(girdi({ speaking: new Set(["o"]) }));
    expect(k[0]).toMatchObject({ konusuyor: false });
    expect(k[1]).toMatchObject({ konusuyor: true });
  });

  it("uzak bayraklar uye kaydindan gelir", () => {
    const k = sahneKareleri(girdi({
      members: [uye("ben"), uye("o", { muted: true, deafened: true })],
    }));
    expect(k[1]).toMatchObject({ muted: true, deafened: true });
  });

  it("kendi bayraklari sunucu yankisindan degil yerel durumdan gelir", () => {
    // Sunucu yankisi bir tur gecikir; kendi mikrofonunun gostergesi gecikmemeli.
    const k = sahneKareleri(girdi({
      members: [uye("ben", { muted: false }), uye("o")],
      selfMuted: true,
    }));
    expect(k[0]).toMatchObject({ muted: true });
  });

  it("failed baglanti kopuk isaretlenir", () => {
    const k = sahneKareleri(girdi({ connection: new Map([["o", "failed"]]) }));
    expect(k[1]).toMatchObject({ kopuk: true });
  });

  it("kendi karesi asla kopuk degildir", () => {
    const k = sahneKareleri(girdi({ connection: new Map([["ben", "failed"]]) }));
    expect(k[0]).toMatchObject({ kopuk: false });
  });

  it("ad bilinmiyorsa uc nokta yazar", () => {
    const k = sahneKareleri(girdi({ adlar: new Map() }));
    expect(k[0]).toMatchObject({ ad: "…", harf: "?" });
  });

  it("anahtarlar tur ile birlikte benzersiz", () => {
    const k = sahneKareleri(girdi({ local: { cam: null, screenVideo: track() } }));
    const anahtarlar = k.map((x) => x.anahtar);
    expect(anahtarlar).toContain("ben-ekran");
    expect(anahtarlar).toContain("ben-kisi");
    expect(new Set(anahtarlar).size).toBe(anahtarlar.length);
  });
});

describe("sahneKareleri gorunum modu", () => {
  it("video modunda videosuz kisi kareleri dusurulur", () => {
    const t = track();
    const k = sahneKareleri(girdi({
      members: [uye("ben"), uye("o", { camera: true })],
      remote: new Map([["o", uzak({ cam: t })]]),
      mod: "video",
    }));
    expect(k.map((x) => x.userId)).toEqual(["o"]);
  });

  it("video modunda ekran kareleri her zaman kalir", () => {
    const k = sahneKareleri(girdi({
      members: [uye("ben"), uye("o", { screen: true })],
      remote: new Map([["o", uzak({ screenVideo: track() })]]),
      mod: "video",
    }));
    expect(k).toHaveLength(1);
    expect(k[0].tur).toBe("ekran");
  });

  it("video modunda hic video yoksa liste bos doner", () => {
    expect(sahneKareleri(girdi({ mod: "video" }))).toEqual([]);
  });

  it("herkes modunda videosuzlar kalir", () => {
    expect(sahneKareleri(girdi({ mod: "herkes" }))).toHaveLength(2);
  });
});

describe("sahneKareleri gorunurluk bayraklari", () => {
  // Track store'da `ended` gelene kadar duruyor (rtc/session.ts). Kameranin
  // acik olup olmadigini yalnizca sunucunun yaydigi bayrak soyler; track'in
  // varligina bakmak gecici paket kaybini "kamera kapandi" gibi okur.
  it("kamera bayragi kapaliyken uzak track cizilmez", () => {
    const k = sahneKareleri(girdi({
      members: [uye("ben"), uye("o", { camera: false })],
      remote: new Map([["o", uzak({ cam: track() })]]),
    }));
    expect(k[1]).toMatchObject({ userId: "o", track: null, harf: "A" });
  });

  it("kamera bayragi acikken uzak track cizilir", () => {
    const t = track();
    const k = sahneKareleri(girdi({
      members: [uye("ben"), uye("o", { camera: true })],
      remote: new Map([["o", uzak({ cam: t })]]),
    }));
    expect(k[1]).toMatchObject({ userId: "o", track: t });
  });

  it("bayrak acik ama track henuz yoksa harf cizilir", () => {
    const k = sahneKareleri(girdi({
      members: [uye("ben"), uye("o", { camera: true })],
    }));
    expect(k[1]).toMatchObject({ userId: "o", track: null });
  });

  it("ekran bayragi kapaliyken uzak ekran karesi uretilmez", () => {
    const k = sahneKareleri(girdi({
      members: [uye("ben"), uye("o", { screen: false })],
      remote: new Map([["o", uzak({ screenVideo: track() })]]),
    }));
    expect(k.every((x) => x.tur === "kisi")).toBe(true);
  });

  it("ekran bayragi acikken uzak ekran karesi uretilir", () => {
    const k = sahneKareleri(girdi({
      members: [uye("ben"), uye("o", { screen: true })],
      remote: new Map([["o", uzak({ screenVideo: track() })]]),
    }));
    expect(k[0]).toMatchObject({ tur: "ekran", userId: "o" });
  });

  it("kendi karen bayraga degil yerel track'e bakar", () => {
    // Kendi bayragin sunucu yankisiyla bir tur gecikir; onizleme gecikmemeli.
    const t = track();
    const k = sahneKareleri(girdi({
      members: [uye("ben", { camera: false }), uye("o")],
      local: { cam: t, screenVideo: null },
    }));
    expect(k[0]).toMatchObject({ kendisi: true, track: t });
  });
});

describe("sahneDuzeni", () => {
  it("ekran yokken kisi kareleri galeride, serit bos", () => {
    const d = sahneDuzeni(girdi());
    expect(d.ekranlar).toHaveLength(0);
    expect(d.kisiler.map((k) => k.userId)).toEqual(["ben", "o"]);
  });

  it("ekran varken ekranlar ve kisiler ayri listelerde", () => {
    const d = sahneDuzeni(girdi({
      members: [uye("ben"), uye("o", { screen: true })],
      remote: new Map([["o", uzak({ screenVideo: track() })]]),
    }));
    expect(d.ekranlar.map((e) => e.userId)).toEqual(["o"]);
    expect(d.kisiler.map((k) => k.userId)).toEqual(["ben", "o"]);
  });

  it("sahneKareleri duzenin duz hali: once ekranlar", () => {
    const g = girdi({
      members: [uye("ben"), uye("o", { screen: true, camera: true })],
      remote: new Map([["o", uzak({ screenVideo: track(), cam: track() })]]),
    });
    const d = sahneDuzeni(g);
    expect(sahneKareleri(g)).toEqual([...d.ekranlar, ...d.kisiler]);
  });

  it("video modunda videosuz kisiler seritten de dusurulur", () => {
    const d = sahneDuzeni(girdi({
      members: [uye("ben"), uye("o", { screen: true })],
      remote: new Map([["o", uzak({ screenVideo: track() })]]),
      mod: "video",
    }));
    expect(d.ekranlar).toHaveLength(1);
    expect(d.kisiler).toHaveLength(0);
  });
});
