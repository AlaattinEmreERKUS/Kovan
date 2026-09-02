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
  error: null as string | null,
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
  voice.error = null;
}
