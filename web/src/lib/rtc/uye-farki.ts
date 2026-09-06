export interface UyeFarki {
  girenler: string[];
  cikanlar: string[];
}

const SESSIZ: UyeFarki = { girenler: [], cikanlar: [] };

/**
 * Ses kanali uye listesinin iki hali arasindaki farki verir.
 *
 * `onceki` null ise fark alinmaz. Kopma sonrasi sunucu tam listeyi bastan
 * gonderdigi icin, tohumlanmamis bir izleyici odadaki herkesi "yeni girdi"
 * sayar ve bip yagmuru olur; null o durumu temsil eder.
 *
 * `ben` her iki yonde de suzulur: kendi katilimin listeye kendi id'ni koyar,
 * suzulmezse kendi girisinde "baskasi girdi" bipi duyarsin.
 */
export function uyeFarki(
  onceki: string[] | null,
  yeni: string[],
  ben: string,
): UyeFarki {
  if (onceki === null) return SESSIZ;
  return {
    girenler: yeni.filter((id) => id !== ben && !onceki.includes(id)),
    cikanlar: onceki.filter((id) => id !== ben && !yeni.includes(id)),
  };
}
