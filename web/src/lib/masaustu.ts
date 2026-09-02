/**
 * Masaustu (Tauri) koprusu.
 *
 * Ayni SvelteKit uygulamasi hem tarayicida hem Tauri penceresinde kosuyor:
 * pencere paketlenmis bir kopyayi degil, dogrudan canli siteyi yukluyor.
 * Bu yuzden masaustune ozgu her sey CALISMA ANINDA ayrilir; tarayicida bu
 * modulun her fonksiyonu sessizce "yok" cevabi verir ve cagiran tarafta
 * `if (isTauri())` disinda ek koruma gerekmez.
 */
export type KisayolAdi = "ptt" | "mik" | "kulaklik";

export const KISAYOL_ADLARI: readonly KisayolAdi[] = ["ptt", "mik", "kulaklik"];

export interface KisayolOlayi {
  ad: KisayolAdi;
  durum: "Pressed" | "Released";
}

/** Kullandigimiz iki Tauri API'si. Testte sahtelenebilsin diye ayri tip. */
export interface MasaustuKoprusu {
  listen<T>(olay: string, fn: (e: { payload: T }) => void): Promise<() => void>;
  invoke<T>(komut: string, arg?: unknown): Promise<T>;
}

/** Tauri'nin sayfaya enjekte ettigi global isaretler. */
export interface TauriPencere {
  __TAURI_INTERNALS__?: unknown;
  __TAURI__?: unknown;
}

export function isTauri(pencere: TauriPencere = globalThis as TauriPencere): boolean {
  // SSR sirasinda window yok; bazi ortamlarda erisim denemesi bile atar.
  try {
    return pencere?.__TAURI_INTERNALS__ !== undefined || pencere?.__TAURI__ !== undefined;
  } catch {
    return false;
  }
}

/**
 * Gercek kopru. `withGlobalTauri` acik oldugu icin API global nesneden
 * okunur: uzak sayfanin Tauri paketlerini import etmesi gerekmez, zaten
 * paketleyemezdi de -- ayni derleme tarayicida da kosuyor.
 */
export function kopru(pencere: TauriPencere = globalThis as TauriPencere): MasaustuKoprusu | null {
  const t = pencere?.__TAURI__ as
    | { event?: { listen?: unknown }; core?: { invoke?: unknown } }
    | undefined;
  if (typeof t?.event?.listen !== "function" || typeof t?.core?.invoke !== "function") return null;
  return {
    listen: t.event.listen as MasaustuKoprusu["listen"],
    invoke: t.core.invoke as MasaustuKoprusu["invoke"],
  };
}

function gecerliAd(ad: unknown): ad is KisayolAdi {
  return typeof ad === "string" && (KISAYOL_ADLARI as readonly string[]).includes(ad);
}

/**
 * Rust'in yaydigi "kisayol" olaylarini dinler. Geri donen fonksiyon cozer.
 *
 * Bilinmeyen ad SESSIZCE atlanir: Rust tarafi ileride yeni bir kisayol
 * yayarsa eski arayuz patlamamali.
 */
export async function kisayolDinle(
  k: MasaustuKoprusu,
  fn: (o: KisayolOlayi) => void,
): Promise<() => void> {
  return k.listen<KisayolOlayi>("kisayol", ({ payload }) => {
    if (!gecerliAd(payload?.ad)) return;
    fn({ ad: payload.ad, durum: payload.durum });
  });
}
