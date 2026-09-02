/**
 * Mikrofon kapisi (noise gate) kararlari.
 *
 * Tarayicinin noiseSuppression'i SUREKLI bir filtredir: gurultuyu azaltir
 * ama mikrofonu kapatmaz, yani klavye, fan ve nefes karsi tarafa gider.
 * Discord'un "giris hassasiyeti" dedigi sey bu kapidir: seviye esigin
 * altindayken ses tamamen kesilir.
 *
 * Karar saf tutuluyor; WebAudio'ya dokunan kisim gate.ts'te.
 */
export interface KapiDurumu {
  acik: boolean;
  /** Esigi son astigi an (ms). Bekleme suresi buradan olculur. */
  sonSes: number;
}

/** Konusma araligindaki kisa sessizlikte kapi kapanmasin diye bekleme. */
export const BEKLEME_MS = 250;

/**
 * Sinyal esigi asiyorsa kapi ACILIR ve aninda acilir (kelimenin bası
 * kesilmemeli). Esigin altina duserse BEKLEME_MS boyunca acik kalir;
 * konusma arasindaki nefes molasinda kapanip acilmasi "kesik kesik"
 * duyulurdu.
 */
export function kapiKarari(
  seviye: number,
  esik: number,
  onceki: KapiDurumu,
  simdi: number,
): KapiDurumu {
  if (seviye >= esik) return { acik: true, sonSes: simdi };
  const acik = simdi - onceki.sonSes < BEKLEME_MS;
  return { acik, sonSes: onceki.sonSes };
}

/** Esik 0 ise kapi devre disidir: her sey gecer. */
export function kapiKapali(esik: number): boolean {
  return esik <= 0;
}
