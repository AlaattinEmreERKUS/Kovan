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

/** Kapinin kumandasi: ses seviyesi mi, tus mu. */
export type GirisModu = "ses-etkinligi" | "bas-konus";

export const GIRIS_MODU_VARSAYILAN: GirisModu = "ses-etkinligi";

export interface KapiGirdisi {
  mod: GirisModu;
  /** Anlik RMS. */
  seviye: number;
  esik: number;
  /** Bas-konus tusu su an basili mi. */
  basili: boolean;
  onceki: KapiDurumu;
  simdi: number;
}

/**
 * Tek karar noktasi. Iki ayri fonksiyon yerine mod alan tek fonksiyon:
 * cagiranin yanlis olani secmesi mumkun olmasin.
 *
 * `ses-etkinligi`: esigi asinca aninda acilir (kelimenin basi kesilmemeli),
 * altina duserse BEKLEME_MS boyunca acik kalir (nefes molasinda kesilmesin).
 *
 * `bas-konus`: yalniz tus basiliyken acik ve BEKLEME UYGULANMAZ -- birakinca
 * ceyrek saniye oda gurultusu yayinlamak istemiyoruz. `sonSes`e de
 * dokunulmaz: moda geri donuldugunde kapi bayat bir damgayla acik kalirdi.
 */
export function kapiKarari(g: KapiGirdisi): KapiDurumu {
  if (g.mod === "bas-konus") {
    return { acik: g.basili, sonSes: g.onceki.sonSes };
  }
  if (g.seviye >= g.esik) return { acik: true, sonSes: g.simdi };
  const acik = g.simdi - g.onceki.sonSes < BEKLEME_MS;
  return { acik, sonSes: g.onceki.sonSes };
}

/** Esik 0 ise kapi devre disidir: her sey gecer. */
export function kapiKapali(esik: number): boolean {
  return esik <= 0;
}
