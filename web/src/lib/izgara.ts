export interface IzgaraOlcusu {
  sutun: number;
  satir: number;
}

/** Kare oranı 16/9; sahnedeki her kutu bu orandadır. */
export const KARE_ORANI = 16 / 9;

/**
 * Kareleri alana YAYAR: Discord gibi, kaç sütun kullanılırsa kare en büyük
 * oluyorsa onu seçer.
 *
 * `auto-fit, minmax(240px, 1fr)` bunu yapamaz: sütun sayısını yalnızca
 * genişlikten türetir, yüksekliği hiç görmez. İki kişi geniş bir pencerede
 * yan yana durup üstte küçük kalıyordu; dar pencerede ise alt alta gelip
 * taşıyordu.
 *
 * Yükseklik veya genişlik henüz ölçülmemişse (0) sütun sayısı 1 döner;
 * ölçüm gelince yeniden hesaplanır.
 */
export function izgaraOlcusu(
  sayi: number,
  en: number,
  boy: number,
  bosluk = 10,
  oran = KARE_ORANI,
): IzgaraOlcusu {
  if (sayi <= 0) return { sutun: 1, satir: 0 };
  if (en <= 0 || boy <= 0) return { sutun: 1, satir: sayi };

  let enIyi = { sutun: 1, satir: sayi };
  let enBuyukAlan = -1;

  for (let sutun = 1; sutun <= sayi; sutun++) {
    const satir = Math.ceil(sayi / sutun);
    const hucreEn = (en - bosluk * (sutun - 1)) / sutun;
    const hucreBoy = (boy - bosluk * (satir - 1)) / satir;
    if (hucreEn <= 0 || hucreBoy <= 0) continue;

    // Kare hucreye SIGAR: hangisi kisitliyorsa olcuyu o belirler.
    const kareEn = Math.min(hucreEn, hucreBoy * oran);
    const alan = kareEn * (kareEn / oran);
    if (alan > enBuyukAlan) {
      enBuyukAlan = alan;
      enIyi = { sutun, satir };
    }
  }
  return enIyi;
}
