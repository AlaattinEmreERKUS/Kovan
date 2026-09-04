/**
 * Masaustu uygulamasi indirme seridi. Tercih KISIYE OZEL ve yerel: kapatan
 * kisi bir daha gormez, digerleri gormeye devam eder.
 */

/**
 * `.msi` web ile ayni yerden, Pages'ten servis ediliyor. Surum numarasi
 * degisince burasi da guncellenmeli (`desktop/README.md`).
 */
export const INDIRME_ADRESI = "/indir/Kovan_0.1.0_x64_en-US.msi";

const ANAHTAR = "kovan_indir_seridi";
const KAPALI = "kapali";

/** localStorage'in kullandigimiz iki metodu. Testte sahtelenebilsin diye ayri tip. */
export interface DepoBenzeri {
  getItem(anahtar: string): string | null;
  setItem(anahtar: string, deger: string): void;
}

function varsayilanDepo(): DepoBenzeri | null {
  // SSR sirasinda localStorage yok; erisim denemesi bile bazi tarayicilarda
  // (gizli sekme, site verisi engelli) istisna firlatir.
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Serit cizilsin mi. Masaustunde ASLA: zaten uygulamanin icindesin, indirme
 * cagrisi anlamsiz olurdu.
 */
export function indirmeGorunsun(
  masaustunde: boolean,
  depo: DepoBenzeri | null = varsayilanDepo(),
): boolean {
  if (masaustunde) return false;
  if (!depo) return true;
  try {
    return depo.getItem(ANAHTAR) !== KAPALI;
  } catch {
    // Tercih okunamiyorsa gorunmemektense gorunsun; kapat dugmesi duruyor.
    return true;
  }
}

export function indirmeKapat(depo: DepoBenzeri | null = varsayilanDepo()): void {
  if (!depo) return;
  try {
    depo.setItem(ANAHTAR, KAPALI);
  } catch {
    // Kota dolu ya da yazma engelli: serit her acilista tekrar cikar.
  }
}
