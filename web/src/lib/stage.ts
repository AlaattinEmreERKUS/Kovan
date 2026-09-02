import type { VoiceMember } from "@shared/protocol";
import type { RemoteTracks } from "./voice.svelte";
import type { GorunumModu } from "./gorunum";

/** Yerel video yuvalari. voice.svelte.ts bu tipi yeniden disa aktarir (Task 3). */
export interface YerelTracks {
  cam: MediaStreamTrack | null;
  screenVideo: MediaStreamTrack | null;
}

export interface EkranKare {
  tur: "ekran";
  anahtar: string;
  userId: string;
  ad: string;
  track: MediaStreamTrack;
  kendisi: boolean;
}

export interface KisiKare {
  tur: "kisi";
  anahtar: string;
  userId: string;
  ad: string;
  /** Kamera kapaliysa null; o zaman `harf` cizilir. */
  track: MediaStreamTrack | null;
  harf: string;
  kendisi: boolean;
  konusuyor: boolean;
  muted: boolean;
  deafened: boolean;
  kopuk: boolean;
}

export type Kare = EkranKare | KisiKare;

export interface SahneGirdisi {
  members: readonly VoiceMember[];
  remote: ReadonlyMap<string, RemoteTracks>;
  local: YerelTracks;
  speaking: ReadonlySet<string>;
  connection: ReadonlyMap<string, RTCPeerConnectionState>;
  adlar: ReadonlyMap<string, string>;
  selfId: string;
  /** Kendi bayraklari sunucu yankisini beklemeden yerel durumdan gelir. */
  selfMuted: boolean;
  selfDeafened: boolean;
  mod: GorunumModu;
}

const AD_YOK = "…";

/**
 * Avatar dairesindeki harf. Turkce yerel ayari sart: varsayilan toUpperCase
 * "istanbul" icin "I" verir, dogrusu "İ".
 */
export function basHarf(ad: string): string {
  const kirpik = ad.trim();
  if (kirpik.length === 0 || kirpik === AD_YOK) return "?";
  return kirpik.charAt(0).toLocaleUpperCase("tr-TR");
}

/** Kendisi bassa alinir; gerisi sunucunun verdigi sirada kalir. */
function siralaKendisiOnce(members: readonly VoiceMember[], selfId: string): VoiceMember[] {
  const ben = members.filter((m) => m.userId === selfId);
  const digerleri = members.filter((m) => m.userId !== selfId);
  return [...ben, ...digerleri];
}

export function sahneKareleri(g: SahneGirdisi): Kare[] {
  const sirali = siralaKendisiOnce(g.members, g.selfId);
  const adOf = (userId: string) => g.adlar.get(userId) ?? AD_YOK;

  // Ekran kareleri once: dikkatin merkezi paylasilan ekrandir.
  const ekranlar: EkranKare[] = [];
  for (const m of sirali) {
    const kendisi = m.userId === g.selfId;
    const track = kendisi ? g.local.screenVideo : g.remote.get(m.userId)?.screenVideo ?? null;
    if (!track) continue;
    ekranlar.push({
      tur: "ekran",
      anahtar: `${m.userId}-ekran`,
      userId: m.userId,
      ad: adOf(m.userId),
      track,
      kendisi,
    });
  }

  const kisiler: KisiKare[] = [];
  for (const m of sirali) {
    const kendisi = m.userId === g.selfId;
    const track = kendisi ? g.local.cam : g.remote.get(m.userId)?.cam ?? null;
    // "video" modu yalnizca kisi karelerini eler; ekran paylasimi her zaman gorunur.
    if (g.mod === "video" && track === null) continue;
    const ad = adOf(m.userId);
    kisiler.push({
      tur: "kisi",
      anahtar: `${m.userId}-kisi`,
      userId: m.userId,
      ad,
      track,
      harf: basHarf(ad),
      kendisi,
      konusuyor: g.speaking.has(m.userId),
      muted: kendisi ? g.selfMuted : m.muted,
      deafened: kendisi ? g.selfDeafened : m.deafened,
      // Kendinle baglanti kurmuyorsun; kendi karende kopuk rozeti anlamsiz.
      kopuk: !kendisi && g.connection.get(m.userId) === "failed",
    });
  }

  return [...ekranlar, ...kisiler];
}
