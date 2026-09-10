/**
 * Mesaj metnini duz metin ve link parcalarina ayirir. Render tarafi parcalari
 * text node ve <a> olarak basar -- {@html} YOK, yani mesaj icerigi hicbir
 * kosulda HTML olarak yorumlanmaz.
 *
 * Parcalama kayipsizdir: parcalarin `metin` alanlari birlesince mesajin
 * kendisi geri gelir.
 */
export type Parca =
  | { tur: "metin"; metin: string }
  | { tur: "link"; metin: string; href: string };

/** Aday: sema ya da www ile baslar, bosluga kadar gider. Kirpma sonra. */
const ADAY = /(?:https?:\/\/|www\.)[^\s<>"]+/gi;

/** Cumle sonu noktalamasi linke yapisirsa adres bozulur ("https://a.com." 404). */
const SON_ISARET = /[.,!?:;'"]$/;

function say(s: string, c: string): number {
  let n = 0;
  for (const x of s) if (x === c) n++;
  return n;
}

/**
 * Sondaki noktalamayi ve esi olmayan kapanis parantezini atar. Dengeli
 * parantez yolun parcasidir (Vikipedi: `Kovan_(arıcılık)`), "(link)" icindeki
 * kapanis ise degildir.
 */
function kirp(aday: string): string {
  let s = aday;
  for (;;) {
    if (SON_ISARET.test(s)) { s = s.slice(0, -1); continue; }
    if (s.endsWith(")") && say(s, "(") < say(s, ")")) { s = s.slice(0, -1); continue; }
    return s;
  }
}

/** Yalniz http(s) tiklanabilir. Gecersiz adres (orn. yalniz sema) link olmaz. */
function adres(s: string): string | null {
  const href = /^www\./i.test(s) ? `https://${s}` : s;
  try {
    const u = new URL(href);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname ? href : null;
  } catch {
    return null;
  }
}

export function parcala(mesaj: string): Parca[] {
  const parcalar: Parca[] = [];
  const metinEkle = (m: string) => {
    if (m.length === 0) return;
    const son = parcalar.at(-1);
    if (son?.tur === "metin") son.metin += m;
    else parcalar.push({ tur: "metin", metin: m });
  };

  let imlec = 0;
  for (const eslesme of mesaj.matchAll(ADAY)) {
    const bas = eslesme.index;
    const aday = kirp(eslesme[0]);
    const href = adres(aday);
    metinEkle(mesaj.slice(imlec, bas));
    if (href) {
      parcalar.push({ tur: "link", metin: aday, href });
      imlec = bas + aday.length;
    } else {
      imlec = bas;
    }
  }
  metinEkle(mesaj.slice(imlec));
  return parcalar;
}
