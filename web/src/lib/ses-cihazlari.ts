import { varsayilanDepo, type DepoBenzeri } from "./ses-ayarlari";

/**
 * Kullanicinin cihaz TERCIHI. `null` = sistem varsayilani.
 *
 * SesAyarlari'ndan AYRI duruyor: o nesne mikKisitlari() ile applyConstraints'e
 * gidiyor ve deviceId'nin orada isi yok -- cihaz degistirme applyConstraints
 * ile guvenilir calismaz.
 *
 * Bu tercih, o an GERCEKTEN calan cihazla ayni olmayabilir: kulaklik cikarilinca
 * varsayilana duseriz ama tercih durur, geri takilinca ona doneriz.
 */
export interface CihazSecimi {
  giris: string | null;
  cikis: string | null;
}

export const CIHAZ_SECIMI_VARSAYILAN: CihazSecimi = { giris: null, cikis: null };

const ANAHTAR = "kovan_ses_cihazlari";

/** Taninmayan deger null'a duser: eski ya da elle bozulmus kayit is gormesin. */
function kimlik(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function cihazSecimiOku(depo: DepoBenzeri | null = varsayilanDepo()): CihazSecimi {
  if (!depo) return { ...CIHAZ_SECIMI_VARSAYILAN };
  try {
    const ham = depo.getItem(ANAHTAR);
    if (ham === null) return { ...CIHAZ_SECIMI_VARSAYILAN };
    const o = JSON.parse(ham) as Partial<CihazSecimi>;
    return { giris: kimlik(o.giris), cikis: kimlik(o.cikis) };
  } catch {
    // Bozuk kayit secimi sifirlar, uygulamayi durdurmaz.
    return { ...CIHAZ_SECIMI_VARSAYILAN };
  }
}

export function cihazSecimiYaz(
  s: CihazSecimi,
  depo: DepoBenzeri | null = varsayilanDepo(),
): void {
  if (!depo) return;
  try {
    depo.setItem(ANAHTAR, JSON.stringify({ giris: kimlik(s.giris), cikis: kimlik(s.cikis) }));
  } catch {
    // Kota dolu ya da yazma engelli: secim kalici olmaz, ses calismaya devam eder.
  }
}
