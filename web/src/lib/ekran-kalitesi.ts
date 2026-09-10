import { varsayilanDepo, type DepoBenzeri } from "./ses-ayarlari";

/**
 * Ekran paylasiminin yakalama kalitesi. KISIYE OZEL ve yerel: sunucuya
 * gitmez, izleyiciye bildirilmez.
 *
 * Bu bir TAVAN, garanti degil. Mesh'te paylasan her izleyici icin ayri encode
 * yapar; upload ya da CPU yetmezse encoder secimin altina iner. Gercekte giden
 * deger `kovanDurum()` teshisinde gorunur.
 */
export type Cozunurluk = "720p" | "1080p" | "kaynak";
export type Fps = 15 | 30 | 60;

export interface EkranKalitesi {
  cozunurluk: Cozunurluk;
  fps: Fps;
}

export const COZUNURLUKLER: readonly Cozunurluk[] = ["720p", "1080p", "kaynak"];
export const FPSLER: readonly Fps[] = [15, 30, 60];

/** Bu ozellikten ONCEKI davranis: dokunmayan kullanicida hicbir sey degismez. */
export const EKRAN_KALITESI_VARSAYILAN: EkranKalitesi = { cozunurluk: "kaynak", fps: 30 };

const ANAHTAR = "kovan_ekran_kalitesi";

const BOYUT: Record<Exclude<Cozunurluk, "kaynak">, { w: number; h: number }> = {
  "720p": { w: 1280, h: 720 },
  "1080p": { w: 1920, h: 1080 },
};

function cozunurluk(v: unknown): Cozunurluk {
  return COZUNURLUKLER.includes(v as Cozunurluk)
    ? (v as Cozunurluk)
    : EKRAN_KALITESI_VARSAYILAN.cozunurluk;
}

function fps(v: unknown): Fps {
  return FPSLER.includes(v as Fps) ? (v as Fps) : EKRAN_KALITESI_VARSAYILAN.fps;
}

export function ekranKalitesiOku(depo: DepoBenzeri | null = varsayilanDepo()): EkranKalitesi {
  if (!depo) return { ...EKRAN_KALITESI_VARSAYILAN };
  try {
    const ham = depo.getItem(ANAHTAR);
    if (ham === null) return { ...EKRAN_KALITESI_VARSAYILAN };
    const o = JSON.parse(ham) as Partial<EkranKalitesi>;
    return { cozunurluk: cozunurluk(o.cozunurluk), fps: fps(o.fps) };
  } catch {
    // Bozuk kayit secimi sifirlar, uygulamayi durdurmaz.
    return { ...EKRAN_KALITESI_VARSAYILAN };
  }
}

export function ekranKalitesiYaz(
  k: EkranKalitesi,
  depo: DepoBenzeri | null = varsayilanDepo(),
): void {
  if (!depo) return;
  try {
    depo.setItem(ANAHTAR, JSON.stringify({ cozunurluk: cozunurluk(k.cozunurluk), fps: fps(k.fps) }));
  } catch {
    // Kota dolu ya da yazma engelliyse secim kalici olmaz, paylasim surer.
  }
}

/**
 * getDisplayMedia ve applyConstraints icin video kisitlari.
 *
 * Kaynak'ta boyut anahtari HIC konmaz: applyConstraints kisit setini tumuyle
 * degistirir, 720p'den kaynak'a donuste eski tavanin kalkmasi buna bagli.
 */
export function ekranKisitlari(k: EkranKalitesi): MediaTrackConstraints {
  if (k.cozunurluk === "kaynak") return { frameRate: k.fps };
  const { w, h } = BOYUT[k.cozunurluk];
  return { width: { max: w }, height: { max: h }, frameRate: k.fps };
}

/**
 * Encoder'a sikisinca neyi feda edecegini soyler. Kullaniciya ayri bir ayar
 * olarak sorulmaz: 60 fps secen akicilik istiyordur (oyun), digerleri
 * okunaklilik (yazi, kod).
 */
export function icerikIpucu(k: EkranKalitesi): "motion" | "detail" {
  return k.fps === 60 ? "motion" : "detail";
}
