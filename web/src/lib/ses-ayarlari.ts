import { GIRIS_MODU_VARSAYILAN, type GirisModu } from "./rtc/kapi";

/**
 * Giden mikrofonun isleme ayarlari. Hepsi KISIYE OZEL ve yerel: sunucuya
 * gitmez, karsi tarafa bildirilmez.
 */
export interface SesAyarlari {
  /** Kapi esigi (RMS). 0 = kapi devre disi, her ses gecer. */
  esik: number;
  yankiEngelleme: boolean;
  gurultuBastirma: boolean;
  otomatikSeviye: boolean;
  /** Kapiyi ne kumanda eder. Bas-konus yalniz masaustunde secilebilir. */
  girisModu: GirisModu;
}

export const ESIK_MAKS = 0.1;

export const SES_AYARI_VARSAYILAN: SesAyarlari = {
  // Sessiz bir odada nefes ve fan ~0.005, konusma ~0.03-0.2 arasinda olcer.
  esik: 0.015,
  yankiEngelleme: true,
  gurultuBastirma: true,
  otomatikSeviye: true,
  girisModu: GIRIS_MODU_VARSAYILAN,
};

const ANAHTAR = "kovan_ses_ayarlari";

export interface DepoBenzeri {
  getItem(anahtar: string): string | null;
  setItem(anahtar: string, deger: string): void;
}

export function varsayilanDepo(): DepoBenzeri | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function kirp(v: unknown): number {
  const s = typeof v === "number" && Number.isFinite(v) ? v : SES_AYARI_VARSAYILAN.esik;
  return Math.min(ESIK_MAKS, Math.max(0, s));
}

function bayrak(v: unknown, varsayilan: boolean): boolean {
  return typeof v === "boolean" ? v : varsayilan;
}

/** Taninmayan deger varsayilana duser: eski ya da elle bozulmus kayit
 * uygulamayi durdurmamali. */
function mod(v: unknown): GirisModu {
  return v === "bas-konus" || v === "ses-etkinligi" ? v : GIRIS_MODU_VARSAYILAN;
}

export function sesAyarlariOku(depo: DepoBenzeri | null = varsayilanDepo()): SesAyarlari {
  if (!depo) return { ...SES_AYARI_VARSAYILAN };
  try {
    const ham = depo.getItem(ANAHTAR);
    if (ham === null) return { ...SES_AYARI_VARSAYILAN };
    const o = JSON.parse(ham) as Partial<SesAyarlari>;
    return {
      esik: kirp(o.esik),
      yankiEngelleme: bayrak(o.yankiEngelleme, SES_AYARI_VARSAYILAN.yankiEngelleme),
      gurultuBastirma: bayrak(o.gurultuBastirma, SES_AYARI_VARSAYILAN.gurultuBastirma),
      otomatikSeviye: bayrak(o.otomatikSeviye, SES_AYARI_VARSAYILAN.otomatikSeviye),
      girisModu: mod(o.girisModu),
    };
  } catch {
    // Bozuk ya da okunamayan kayit ayarlari sifirlar, uygulamayi durdurmaz.
    return { ...SES_AYARI_VARSAYILAN };
  }
}

export function sesAyarlariYaz(a: SesAyarlari, depo: DepoBenzeri | null = varsayilanDepo()): void {
  if (!depo) return;
  try {
    depo.setItem(ANAHTAR, JSON.stringify({ ...a, esik: kirp(a.esik) }));
  } catch {
    // Kota dolu ya da yazma engelli: ayar kalici olmaz, ses calismaya devam eder.
  }
}

/** getUserMedia / applyConstraints icin tarayici karsiliklari. */
export function mikKisitlari(a: SesAyarlari): MediaTrackConstraints {
  return {
    echoCancellation: a.yankiEngelleme,
    noiseSuppression: a.gurultuBastirma,
    autoGainControl: a.otomatikSeviye,
  };
}
