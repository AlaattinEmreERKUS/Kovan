import { SAHTE_KIMLIKLER } from "../ses-cihazlari";

export interface Cihaz {
  id: string;
  etiket: string;
}

export interface CihazDeps {
  enumerateDevices(): Promise<MediaDeviceInfo[]>;
  getUserMedia(c: MediaStreamConstraints): Promise<MediaStream>;
}

export function tarayiciCihazDeps(): CihazDeps {
  return {
    enumerateDevices: () => navigator.mediaDevices.enumerateDevices(),
    getUserMedia: (c) => navigator.mediaDevices.getUserMedia(c),
  };
}

/**
 * Etiketleri acmak icin sessiz izin. enumerateDevices, izin verilene kadar
 * BOS etiket doner ve kullaniciya "Cihaz 1, Cihaz 2" gosterilirdi.
 * Track hemen durdurulur: amac izin, kayit degil.
 */
export async function izinAl(deps: CihazDeps): Promise<boolean> {
  try {
    const stream = await deps.getUserMedia({ audio: true });
    for (const t of stream.getTracks()) t.stop();
    return true;
  } catch {
    // Reddedildi ya da cihaz yok. Liste yine cizilir, etiketler bos kalir.
    return false;
  }
}

/**
 * Chromium ayni fiziksel cihazi UC kayitla dondurur: `default`,
 * `communications` ve gercek id. Ucu de gostermek kullaniciya ayni kulakligi
 * uc kez secmek gibi gorunur.
 *
 * IKI sahte kayit da elenir. "Sistem varsayilani" arayuzde zaten BOS deger
 * olarak duruyor; `default`i ayrica listelemek menude iki ayri "Varsayilan"
 * satiri uretiyordu (2026-09-05 fiziksel test). Tek anlam, tek temsil.
 */
function suz(liste: MediaDeviceInfo[], kind: MediaDeviceKind): Cihaz[] {
  const out: Cihaz[] = [];
  for (const d of liste) {
    if (d.kind !== kind) continue;
    if (SAHTE_KIMLIKLER.includes(d.deviceId)) continue;
    out.push({ id: d.deviceId, etiket: d.label || "Adsız cihaz" });
  }
  return out;
}

export async function cihazlariListele(
  deps: CihazDeps,
): Promise<{ girisler: Cihaz[]; cikislar: Cihaz[] }> {
  let liste: MediaDeviceInfo[];
  try {
    liste = await deps.enumerateDevices();
  } catch {
    // Liste alinamadi. Bos donmek, panelin cizilmemesinden iyidir.
    return { girisler: [], cikislar: [] };
  }
  return { girisler: suz(liste, "audioinput"), cikislar: suz(liste, "audiooutput") };
}

/** Cikis secimi yalnizca Chromium 110+ destekler; yoksa arayuz devre disi cizer. */
export function cikisDesteginVar(): boolean {
  return typeof AudioContext !== "undefined" && "setSinkId" in AudioContext.prototype;
}

/** Gercek tarayici aboneligi. mediaDevices yoksa islemsiz doner. */
export function tarayiciCihazOlaylari() {
  const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
  return {
    ekle(tip: string, f: () => void) { md?.addEventListener(tip, f); },
    kaldir(tip: string, f: () => void) { md?.removeEventListener(tip, f); },
  };
}
