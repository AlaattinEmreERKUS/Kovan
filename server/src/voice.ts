import type { VoiceMember } from "@shared/protocol";
import type { SocketState } from "./sockets";

/** Mesh tavani. 4 kisi = her istemcide 3 RTCPeerConnection (spec 8). */
export const VOICE_CAP = 4;

/** Tek sinyal paketinin ust siniri. Tipik SDP 5-10 KB; 64 KB genis pay birakir. */
export const MAX_SIGNAL = 64 * 1024;

export type VoiceFlags = Pick<SocketState, "muted" | "deafened" | "camera" | "screen" | "screenAudio">;

const FLAG_KEYS = ["muted", "deafened", "camera", "screen", "screenAudio"] as const;

/**
 * Ses kanalindaki kullanicilar. Kullanici basina TEK kayit doner: ayni kisi
 * iki sekme acmis olabilir ve liste onu ikizlememeli.
 *
 * Seste olanlar arasinda EN YENI socket kazanir. Onceden ilk gorulen
 * kazaniyordu: ani kopmada olu socket bir sure listede kaldigi icin geri
 * baglanan kisi hep olu kaydiyla temsil ediliyor, yeni sekmesinden gonderdigi
 * mute/kamera bayraklari hicbir zaman gorunmuyordu.
 *
 * Yenilik kurali YALNIZCA seste olanlara uygulanir: sesten bagimsiz acilmis
 * yeni bir sekme, kisiyi seste olan eski sekmesiyle birlikte listeden
 * dusurmemeli.
 */
export function voiceMembers(states: SocketState[]): VoiceMember[] {
  const byUser = new Map<string, { at: number; uye: VoiceMember }>();
  for (const s of states) {
    if (!s.inVoice) continue;
    const at = s.joinedAt ?? 0;
    const mevcut = byUser.get(s.userId);
    // >= : ayni milisaniyede acilmis iki socket'te sonraki kazanir.
    if (mevcut && at < mevcut.at) continue;
    byUser.set(s.userId, {
      at,
      uye: {
        userId: s.userId,
        muted: s.muted,
        deafened: s.deafened,
        camera: s.camera,
        screen: s.screen,
        screenAudio: s.screenAudio,
      },
    });
  }
  return [...byUser.values()].map((v) => v.uye);
}

/**
 * Istemci girdisi. Bes bayragin HEPSI boolean olmak zorunda; biri degilse
 * paket topluca reddedilir. Ham deger attachment'a yazilirsa hibernation
 * sonrasi bozuk state geri yuklenir ve yayin JSON'u sessizce bozulur.
 */
export function sanitizeVoiceFlags(raw: unknown): VoiceFlags | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  for (const k of FLAG_KEYS) {
    if (typeof o[k] !== "boolean") return null;
  }
  return {
    muted: o.muted as boolean,
    deafened: o.deafened as boolean,
    camera: o.camera as boolean,
    screen: o.screen as boolean,
    screenAudio: o.screenAudio as boolean,
  };
}

/** Zaten iceride olan kullaniciya tavan uygulanmaz (yeniden katilma serbest). */
export function voiceFull(states: SocketState[], userId: string): boolean {
  const ids = new Set(voiceMembers(states).map((m) => m.userId));
  return !ids.has(userId) && ids.size >= VOICE_CAP;
}
