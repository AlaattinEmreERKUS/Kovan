/** Sahnede kimlerin karesi cizilecek. */
export type GorunumModu = "herkes" | "video";

export const VARSAYILAN_GORUNUM: GorunumModu = "herkes";

const ANAHTAR = "kovan_gorunum";

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

function gecerli(deger: string | null): deger is GorunumModu {
  return deger === "herkes" || deger === "video";
}

export function gorunumOku(depo: DepoBenzeri | null = varsayilanDepo()): GorunumModu {
  if (!depo) return VARSAYILAN_GORUNUM;
  try {
    const deger = depo.getItem(ANAHTAR);
    return gecerli(deger) ? deger : VARSAYILAN_GORUNUM;
  } catch {
    return VARSAYILAN_GORUNUM;
  }
}

export function gorunumYaz(mod: GorunumModu, depo: DepoBenzeri | null = varsayilanDepo()): void {
  if (!depo) return;
  try {
    depo.setItem(ANAHTAR, mod);
  } catch {
    // Kota dolu ya da yazma engelli: tercih kalici olmaz, arayuz calismaya devam eder.
  }
}
