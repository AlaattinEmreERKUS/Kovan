import { SvelteMap, SvelteSet } from "svelte/reactivity";
import type { VoiceMember } from "@shared/protocol";

/**
 * Bir uzak kullanicinin dort track yuvasi. Yuvalar transceiver sirasindan
 * gelir (rtc/peer.ts), ayri bir eslesme protokolu yoktur.
 */
export interface RemoteTracks {
  mic: MediaStreamTrack | null;
  cam: MediaStreamTrack | null;
  screenVideo: MediaStreamTrack | null;
  screenAudio: MediaStreamTrack | null;
}

export function bosTracks(): RemoteTracks {
  return { mic: null, cam: null, screenVideo: null, screenAudio: null };
}

import type { RemoteAudioMixer } from "./rtc/gain";
import { sesAyarlariOku, type SesAyarlari } from "./ses-ayarlari";
import type { YerelTracks } from "./stage";
export type { YerelTracks };

export function bosYerel(): YerelTracks {
  return { cam: null, screenVideo: null };
}

/**
 * Duz Set/Map $state icinde derin tepkisel DEGILDIR (store.svelte.ts'teki
 * ayni gerekce). svelte/reactivity karsiliklari zorunlu.
 */
export const voice = $state({
  /** Ses kanalinda miyim. Sunucunun listesinden degil, kendi eylemimden gelir. */
  joined: false,
  members: [] as VoiceMember[],
  muted: false,
  deafened: false,
  camera: false,
  screen: false,
  screenAudio: false,
  /** Su an konusan kullanicilar. Yerel olcum, sunucuya GITMEZ. */
  speaking: new SvelteSet<string>(),
  remote: new SvelteMap<string, RemoteTracks>(),
  /**
   * Kendi video track'lerimiz. Bileşenler LocalMedia'ya erisemez; kendi
   * karendeki onizleme bu yuzden buradan okunur. Mikrofon ve ekran sesi
   * BILEREK yok: kendi sesini render etmek geri besleme demektir.
   */
  local: bosYerel(),
  /**
   * userId -> RTCPeerConnection durumu. "failed" kalici bir arizadir: ICE
   * hicbir yol bulamadi. TURN olmadan simetrik NAT arkasindaki kullanicida
   * tam olarak bu olur ve arayuz susarsa kullanici mikrofonunu suclar.
   */
  connection: new SvelteMap<string, RTCPeerConnectionState>(),
  error: null as string | null,
  /**
   * Ses mikserleri BURADA durur, VoiceSession'in alaninda degil. Svelte 5
   * sinif ornegini derin tepkisel yapmaz: `oturum.micMixer` join sirasinda
   * dolunca hicbir abone uyanmiyordu ve bilesenler mikseri null gormeye
   * devam ediyordu. Sonucu: RemoteAudio yedek <audio> yolunu acik tutuyor,
   * ses hem elementten hem GainNode'dan geliyordu -- kulaga yanki gibi
   * geliyor ve kaydirici hicbir sey yapmiyordu (gain 0'da bile ses vardi).
   */
  ekranMikseri: null as RemoteAudioMixer | null,
  mikMikseri: null as RemoteAudioMixer | null,
  /** Giden mikrofonun anlik seviyesi (RMS); ayar ekranindaki cubuk. */
  girisSeviyesi: 0,
  sesAyarlari: sesAyarlariOku() as SesAyarlari,
});

/** Sunucuya gonderilecek bayrak paketi. voice.state govdesiyle birebir. */
export function localFlags() {
  return {
    muted: voice.muted,
    deafened: voice.deafened,
    camera: voice.camera,
    screen: voice.screen,
    screenAudio: voice.screenAudio,
  };
}

/** Baglanti koptugunda veya kanaldan cikildiginda cagrilir. */
export function resetVoice(): void {
  voice.joined = false;
  voice.members = [];
  voice.muted = false;
  voice.deafened = false;
  voice.camera = false;
  voice.screen = false;
  voice.screenAudio = false;
  voice.speaking.clear();
  voice.remote.clear();
  voice.local = bosYerel();
  voice.connection.clear();
  voice.error = null;
  voice.ekranMikseri = null;
  voice.mikMikseri = null;
  voice.girisSeviyesi = 0;
}
