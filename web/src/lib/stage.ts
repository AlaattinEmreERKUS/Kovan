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

/**
 * Uzak video yuvasi. Track store'da `ended` gelene kadar durur (session.ts);
 * "yayin acik mi" sorusunu YALNIZCA sunucunun yaydigi bayrak cevaplar.
 *
 * Track'in varligina veya `muted` durumuna bakmak yanlis olurdu: kamera
 * kapatildiginda replaceTrack(null) uzak track'i sonlandirmaz, yalnizca
 * susturur -- donmus son kare ekranda kalirdi. Ters yonde de Chrome gecici
 * paket kaybinda mute atesliyor; ona bakan arayuz her tikanmada kareyi
 * siyaha dusuruyordu.
 */
function uzakVideo(
  g: SahneGirdisi,
  m: VoiceMember,
  yuva: "cam" | "screenVideo",
  acik: boolean,
): MediaStreamTrack | null {
  if (!acik) return null;
  return g.remote.get(m.userId)?.[yuva] ?? null;
}

/**
 * Sahnenin iki bolgesi. Ekran paylasiliyorsa ekranlar ana alani kaplar ve
 * kisi kareleri altta serite iner (Discord duzeni); ekran yoksa kisiler ana
 * alanda galeri olur. Ayrim burada yapilir, bilesende degil: hangi karenin
 * nerede cizilecegi DOM'suz test edilebilir bir karar.
 */
export interface SahneDuzeni {
  ekranlar: EkranKare[];
  kisiler: KisiKare[];
}

export function sahneDuzeni(g: SahneGirdisi): SahneDuzeni {
  const sirali = siralaKendisiOnce(g.members, g.selfId);
  const adOf = (userId: string) => g.adlar.get(userId) ?? AD_YOK;

  // Ekran kareleri once: dikkatin merkezi paylasilan ekrandir.
  const ekranlar: EkranKare[] = [];
  for (const m of sirali) {
    const kendisi = m.userId === g.selfId;
    const track = kendisi ? g.local.screenVideo : uzakVideo(g, m, "screenVideo", m.screen);
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
    const track = kendisi ? g.local.cam : uzakVideo(g, m, "cam", m.camera);
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

  return { ekranlar, kisiler };
}

/** Duz liste; sira her zaman once ekranlar. */
export function sahneKareleri(g: SahneGirdisi): Kare[] {
  const { ekranlar, kisiler } = sahneDuzeni(g);
  return [...ekranlar, ...kisiler];
}
